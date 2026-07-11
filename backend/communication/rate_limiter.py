"""Rate limiting por escritório (isolamento lógico)."""

from __future__ import annotations

import time
from typing import Optional

import redis.asyncio as redis


class RateLimiter:
    def __init__(self, redis_client: Optional[redis.Redis] = None) -> None:
        self._redis = redis_client
        self._local: dict[str, list[float]] = {}

    def bind_redis(self, client: redis.Redis) -> None:
        self._redis = client

    async def allow(
        self,
        accountant_id: str,
        *,
        max_per_hour: int,
        max_per_day: int,
    ) -> tuple[bool, Optional[str]]:
        now = time.time()
        hour_key = f"gc:comm:rl:h:{accountant_id}"
        day_key = f"gc:comm:rl:d:{accountant_id}"

        if self._redis is not None:
            try:
                pipe = self._redis.pipeline()
                pipe.incr(hour_key)
                pipe.expire(hour_key, 3600)
                pipe.incr(day_key)
                pipe.expire(day_key, 86400)
                hour_count, _, day_count, _ = await pipe.execute()
                if int(hour_count) > max_per_hour:
                    return False, f"Limite horario atingido ({max_per_hour}/h)"
                if int(day_count) > max_per_day:
                    return False, f"Limite diario atingido ({max_per_day}/dia)"
                return True, None
            except Exception:
                pass

        # Fallback local
        bucket = self._local.setdefault(accountant_id, [])
        bucket[:] = [t for t in bucket if now - t < 86400]
        hour_count = sum(1 for t in bucket if now - t < 3600)
        if hour_count >= max_per_hour:
            return False, f"Limite horario atingido ({max_per_hour}/h)"
        if len(bucket) >= max_per_day:
            return False, f"Limite diario atingido ({max_per_day}/dia)"
        bucket.append(now)
        return True, None
