"""Fila assíncrona estilo BullMQ usando Redis (sorted set + list)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from typing import Any, Awaitable, Callable, Optional

import redis.asyncio as redis

logger = logging.getLogger("communication.queue")

QUEUE_KEY = "gc:comm:queue"
DELAYED_KEY = "gc:comm:delayed"
PROCESSING_KEY = "gc:comm:processing"
WORKER_ID = f"worker_{uuid.uuid4().hex[:8]}"


class CommunicationQueue:
    """Fila com delay via ZSET e consumo via LIST (compatível com Redis 3+)."""

    def __init__(self, redis_url: Optional[str] = None) -> None:
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
        self._redis: Optional[redis.Redis] = None
        self._memory: list[tuple[float, dict[str, Any]]] = []
        self._memory_lock = asyncio.Lock()
        self._use_memory = False

    async def connect(self) -> None:
        try:
            self._redis = redis.from_url(self.redis_url, decode_responses=True)
            await self._redis.ping()
            self._use_memory = False
            logger.info("CommunicationQueue conectada ao Redis (%s)", self.redis_url)
        except Exception as exc:
            logger.warning("Redis indisponivel (%s). Usando fila em memoria.", exc)
            self._redis = None
            self._use_memory = True

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    @property
    def backend(self) -> str:
        return "memory" if self._use_memory else "redis"

    async def enqueue(
        self,
        job: dict[str, Any],
        *,
        delay_seconds: float = 0,
    ) -> str:
        job_id = job.get("job_id") or f"job_{uuid.uuid4().hex}"
        job = {**job, "job_id": job_id, "enqueued_at": time.time()}
        run_at = time.time() + max(0.0, float(delay_seconds))

        if self._use_memory or self._redis is None:
            async with self._memory_lock:
                self._memory.append((run_at, job))
                self._memory.sort(key=lambda x: x[0])
            return job_id

        payload = json.dumps(job, default=str)
        if delay_seconds > 0:
            await self._redis.zadd(DELAYED_KEY, {payload: run_at})
        else:
            await self._redis.lpush(QUEUE_KEY, payload)
        return job_id

    async def _promote_delayed(self) -> None:
        if self._use_memory or self._redis is None:
            return
        now = time.time()
        items = await self._redis.zrangebyscore(DELAYED_KEY, 0, now, start=0, num=50)
        for item in items:
            moved = await self._redis.zrem(DELAYED_KEY, item)
            if moved:
                await self._redis.lpush(QUEUE_KEY, item)

    async def dequeue(self, timeout: float = 1.0) -> Optional[dict[str, Any]]:
        if self._use_memory or self._redis is None:
            async with self._memory_lock:
                now = time.time()
                for i, (run_at, job) in enumerate(self._memory):
                    if run_at <= now:
                        self._memory.pop(i)
                        return job
            await asyncio.sleep(min(timeout, 0.25))
            return None

        await self._promote_delayed()
        # Redis 3 não tem BLMOVE; usamos BRPOP + tracking
        result = await self._redis.brpop(QUEUE_KEY, timeout=max(1, int(timeout)))
        if not result:
            return None
        _, raw = result
        try:
            job = json.loads(raw)
        except json.JSONDecodeError:
            return None
        await self._redis.hset(PROCESSING_KEY, job.get("job_id", raw[:32]), raw)
        return job

    async def ack(self, job_id: str) -> None:
        if self._redis is not None and not self._use_memory:
            await self._redis.hdel(PROCESSING_KEY, job_id)

    async def stats(self) -> dict[str, Any]:
        if self._use_memory or self._redis is None:
            async with self._memory_lock:
                now = time.time()
                ready = sum(1 for t, _ in self._memory if t <= now)
                delayed = sum(1 for t, _ in self._memory if t > now)
            return {
                "backend": "memory",
                "queued": ready,
                "delayed": delayed,
                "processing": 0,
            }
        return {
            "backend": "redis",
            "queued": await self._redis.llen(QUEUE_KEY),
            "delayed": await self._redis.zcard(DELAYED_KEY),
            "processing": await self._redis.hlen(PROCESSING_KEY),
        }


_queue: Optional[CommunicationQueue] = None


async def get_queue() -> CommunicationQueue:
    global _queue
    if _queue is None:
        _queue = CommunicationQueue()
        await _queue.connect()
    return _queue


JobHandler = Callable[[dict[str, Any]], Awaitable[None]]
