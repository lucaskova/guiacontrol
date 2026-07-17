"""Repositórios Mongo do CommunicationCenter."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from communication.domain import (
    CommunicationEventCreate,
    EventStatus,
    MessagePriority,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class EventsRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.communication_events

    async def ensure_indexes(self) -> None:
        await self.col.create_index("status")
        await self.col.create_index("accountant_id")
        await self.col.create_index("created_at")
        # Remove índice antigo unique+sparse (colidia em dedupe_key=null)
        for stale in ("dedupe_key_1", "dedupe_key_unique_sparse"):
            try:
                await self.col.drop_index(stale)
            except Exception:
                pass
        # partialFilterExpression: só indexa quando há string (permite vários sem dedupe)
        await self.col.create_index(
            [("dedupe_key", 1)],
            unique=True,
            partialFilterExpression={"dedupe_key": {"$type": "string"}},
            name="dedupe_key_unique_partial",
        )
        await self.col.create_index([("event", 1), ("status", 1)])

    async def create(self, data: CommunicationEventCreate) -> dict[str, Any]:
        doc: dict[str, Any] = {
            "id": f"cevt_{uuid.uuid4().hex}",
            "company_id": data.company_id,
            "accountant_id": data.accountant_id,
            "client_id": data.client_id,
            "event": data.event.value if hasattr(data.event, "value") else str(data.event),
            "payload": data.payload,
            "status": EventStatus.PENDING.value,
            "attempts": 0,
            "priority": data.priority.value if isinstance(data.priority, MessagePriority) else str(data.priority),
            "cancel_reason": None,
            "created_at": _now(),
            "processed_at": None,
            "next_retry": None,
            "scheduled_for": None,
        }
        # Não gravar dedupe_key=null: índice unique+sparse ainda indexa null e
        # quebra o 2º teste/lembrete sem dedupe (E11000 duplicate key).
        if data.dedupe_key:
            doc["dedupe_key"] = data.dedupe_key
        await self.col.insert_one(doc)
        doc.pop("_id", None)
        return doc

    async def find_by_id(self, event_id: str) -> Optional[dict[str, Any]]:
        return await self.col.find_one({"id": event_id}, {"_id": 0})

    async def find_by_dedupe(self, dedupe_key: str) -> Optional[dict[str, Any]]:
        return await self.col.find_one({"dedupe_key": dedupe_key}, {"_id": 0})

    async def update(self, event_id: str, **fields: Any) -> None:
        await self.col.update_one({"id": event_id}, {"$set": fields})

    async def count_by_status(self, accountant_id: Optional[str] = None) -> dict[str, int]:
        match: dict[str, Any] = {}
        if accountant_id:
            match["accountant_id"] = accountant_id
        pipeline = [
            {"$match": match} if match else {"$match": {}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]
        out: dict[str, int] = {}
        async for row in self.col.aggregate(pipeline):
            out[str(row["_id"])] = int(row["count"])
        return out


class LogsRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.communication_logs

    async def ensure_indexes(self) -> None:
        await self.col.create_index("event_id")
        await self.col.create_index("accountant_id")
        await self.col.create_index("created_at")
        await self.col.create_index("status")
        await self.col.create_index("provider_message_id")

    async def create(self, data: dict[str, Any]) -> dict[str, Any]:
        doc = {
            "id": f"clog_{uuid.uuid4().hex}",
            "created_at": _now(),
            **data,
        }
        await self.col.insert_one(doc)
        doc.pop("_id", None)
        return doc

    async def update(self, log_id: str, **fields: Any) -> None:
        await self.col.update_one({"id": log_id}, {"$set": fields})

    async def list_recent(
        self,
        *,
        accountant_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        q: dict[str, Any] = {}
        if accountant_id:
            q["accountant_id"] = accountant_id
        return await self.col.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)

    async def aggregate_stats(self, accountant_id: Optional[str] = None) -> dict[str, Any]:
        match: dict[str, Any] = {}
        if accountant_id:
            match["accountant_id"] = accountant_id
        pipeline = [
            {"$match": match} if match else {"$match": {}},
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                    "avg_latency": {"$avg": "$latency_ms"},
                }
            },
        ]
        by_status: dict[str, Any] = {}
        async for row in self.col.aggregate(pipeline):
            by_status[str(row["_id"])] = {
                "count": int(row["count"]),
                "avg_latency_ms": row.get("avg_latency"),
            }
        return by_status


class TemplatesRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.communication_templates

    async def ensure_indexes(self) -> None:
        await self.col.create_index("categoria")
        await self.col.create_index("ativo")
        await self.col.create_index("event_types")

    async def upsert(self, doc: dict[str, Any]) -> None:
        await self.col.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)

    async def list_active(
        self,
        *,
        event_type: Optional[str] = None,
        idioma: str = "pt-BR",
        ids: Optional[list[str]] = None,
    ) -> list[dict[str, Any]]:
        q: dict[str, Any] = {"ativo": True, "idioma": idioma}
        if event_type:
            q["event_types"] = event_type
        if ids:
            q["id"] = {"$in": ids}
        return await self.col.find(q, {"_id": 0}).to_list(200)

    async def get(self, template_id: str) -> Optional[dict[str, Any]]:
        return await self.col.find_one({"id": template_id}, {"_id": 0})

    async def list_all(self) -> list[dict[str, Any]]:
        return await self.col.find({}, {"_id": 0}).to_list(500)


class SettingsRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.col = db.communication_settings

    async def ensure_indexes(self) -> None:
        await self.col.create_index("accountant_id", unique=True)

    async def get(self, accountant_id: str) -> Optional[dict[str, Any]]:
        return await self.col.find_one({"accountant_id": accountant_id}, {"_id": 0})

    async def upsert(self, accountant_id: str, data: dict[str, Any]) -> dict[str, Any]:
        data = {**data, "accountant_id": accountant_id, "updated_at": _now()}
        await self.col.update_one({"accountant_id": accountant_id}, {"$set": data}, upsert=True)
        return await self.get(accountant_id) or data
