"""Event Bus interno — único ponto de entrada para disparos."""

from __future__ import annotations

import logging
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from communication.delay import random_send_delay
from communication.domain import CommunicationEventCreate, CommunicationEventType, EventStatus
from communication.queue.client import get_queue
from communication.repository import EventsRepository
from communication.rules.engine import within_send_window
from communication.settings.service import SettingsService

logger = logging.getLogger("communication.events.bus")

# Teste e lembrete manual não esperam a janela comercial (08h–18h).
_IMMEDIATE_EVENTS = {
    CommunicationEventType.TEST_MESSAGE.value,
    CommunicationEventType.MANUAL_REMINDER.value,
}


class EventBus:
    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        events_repo: EventsRepository,
        settings_service: SettingsService,
    ) -> None:
        self.db = db
        self.events = events_repo
        self.settings = settings_service

    async def emit(self, data: CommunicationEventCreate) -> dict[str, Any]:
        if data.dedupe_key:
            existing = await self.events.find_by_dedupe(data.dedupe_key)
            if existing and existing.get("status") not in (
                EventStatus.CANCELLED.value,
                EventStatus.FAILED.value,
            ):
                logger.info("Evento duplicado ignorado: %s", data.dedupe_key)
                return {**existing, "deduplicated": True}

        doc = await self.events.create(data)
        settings = await self.settings.get(data.accountant_id)
        event_name = data.event.value if hasattr(data.event, "value") else str(data.event)
        immediate = event_name in _IMMEDIATE_EVENTS

        if immediate:
            delay = 0.0
            extra_delay = 0.0
            await self.events.update(doc["id"], status=EventStatus.QUEUED.value)
        else:
            # Delay aleatório sempre
            delay = random_send_delay(settings.delay_min_seconds, settings.delay_max_seconds)

            # Se fora da janela, agenda para o próximo horário permitido (+ delay)
            allowed, next_slot = within_send_window(settings)
            extra_delay = 0.0
            scheduled_for = None
            if not allowed and next_slot is not None:
                from datetime import datetime, timezone

                now = datetime.now(timezone.utc)
                slot = next_slot
                if slot.tzinfo is None:
                    from zoneinfo import ZoneInfo

                    slot = slot.replace(tzinfo=ZoneInfo(settings.timezone))
                extra_delay = max(0.0, (slot.astimezone(timezone.utc) - now).total_seconds())
                scheduled_for = slot.astimezone(timezone.utc)
                await self.events.update(
                    doc["id"],
                    status=EventStatus.SCHEDULED.value,
                    scheduled_for=scheduled_for,
                )
            else:
                await self.events.update(doc["id"], status=EventStatus.QUEUED.value)

        total_delay = delay + extra_delay
        queue = await get_queue()
        job_id = await queue.enqueue(
            {
                "event_id": doc["id"],
                "accountant_id": data.accountant_id,
                "priority": doc.get("priority"),
            },
            delay_seconds=total_delay,
        )
        await self.events.update(doc["id"], payload={**doc.get("payload", {}), "_job_id": job_id, "_delay": total_delay})
        logger.info(
            "Evento %s enfileirado (delay=%.1fs backend=%s immediate=%s)",
            doc["id"],
            total_delay,
            queue.backend,
            immediate,
        )
        refreshed = await self.events.find_by_id(doc["id"])
        return refreshed or doc
