"""Facade CommunicationCenter — ponto único de uso pelo restante do app."""

from __future__ import annotations

from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from communication.circuit_breaker import CircuitBreaker
from communication.domain import CommunicationEventCreate, CommunicationEventType, MessagePriority
from communication.events.bus import EventBus
from communication.queue.client import get_queue
from communication.rate_limiter import RateLimiter
from communication.repository import (
    EventsRepository,
    LogsRepository,
    SettingsRepository,
    TemplatesRepository,
)
from communication.rules.engine import RuleEngine
from communication.settings.service import SettingsService
from communication.templates.seed import seed_templates
from communication.templates.service import TemplateService
from communication.workers.processor import MessageWorker


class CommunicationCenter:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.events_repo = EventsRepository(db)
        self.logs_repo = LogsRepository(db)
        self.templates_repo = TemplatesRepository(db)
        self.settings_repo = SettingsRepository(db)
        self.settings = SettingsService(self.settings_repo)
        self.templates = TemplateService(self.templates_repo)
        self.rate_limiter = RateLimiter()
        self.circuit = CircuitBreaker()
        self.rules = RuleEngine(self.rate_limiter, self.circuit)
        self.bus = EventBus(db, self.events_repo, self.settings)
        self.worker = MessageWorker(
            db,
            self.events_repo,
            self.logs_repo,
            self.settings,
            self.templates,
            self.rules,
            self.circuit,
        )
        self._started = False

    async def startup(self) -> None:
        if self._started:
            return
        await self.events_repo.ensure_indexes()
        await self.logs_repo.ensure_indexes()
        await self.templates_repo.ensure_indexes()
        await self.settings_repo.ensure_indexes()
        await seed_templates(self.templates_repo)
        queue = await get_queue()
        if queue._redis is not None:
            self.rate_limiter.bind_redis(queue._redis)
        await self.worker.start()
        self._started = True

    async def shutdown(self) -> None:
        await self.worker.stop()
        queue = await get_queue()
        await queue.close()
        self._started = False

    async def emit(self, data: CommunicationEventCreate) -> dict[str, Any]:
        return await self.bus.emit(data)

    async def emit_guide_reminder(
        self,
        *,
        accountant_id: str,
        empresa_id: str,
        guia_id: str,
        event_type: CommunicationEventType,
        reminder_kind: str,
        payload: dict[str, Any],
        priority: MessagePriority = MessagePriority.NORMAL,
    ) -> dict[str, Any]:
        dedupe = f"{guia_id}:{reminder_kind}"
        if reminder_kind == "pos_vencimento":
            from datetime import datetime
            from zoneinfo import ZoneInfo

            day = datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%Y-%m-%d")
            dedupe = f"{guia_id}:{reminder_kind}:{day}"

        return await self.emit(
            CommunicationEventCreate(
                event=event_type,
                company_id=empresa_id,
                accountant_id=accountant_id,
                client_id=empresa_id,
                priority=priority,
                payload={**payload, "guia_id": guia_id, "empresa_id": empresa_id, "reminder_kind": reminder_kind},
                dedupe_key=dedupe,
            )
        )

    async def emit_manual_reminder(
        self,
        *,
        accountant_id: str,
        empresa_id: str,
        guia_id: str,
        phone: str,
        mensagem: str,
        extra: str = "",
        link: str = "",
    ) -> dict[str, Any]:
        link_block = ""
        if link:
            link_block = (
                f"\n\n*Seu link (abrir no celular):* {link}\n"
                "Nele você vê a guia, paga (PIX ou linha digitável) e pode *marcar como paga* "
                "ou *anexar comprovante* sem depender do escritório."
            )
        extra_block = f"\n\n_Recado do escritório:_ {extra}" if extra else ""
        return await self.emit(
            CommunicationEventCreate(
                event=CommunicationEventType.MANUAL_REMINDER,
                company_id=empresa_id,
                accountant_id=accountant_id,
                client_id=empresa_id,
                priority=MessagePriority.HIGH,
                payload={
                    "guia_id": guia_id,
                    "empresa_id": empresa_id,
                    "phone": phone,
                    "mensagem": mensagem,
                    "extra_block": extra_block,
                    "link": link,
                    "link_block": link_block,
                    "reminder_kind": "manual",
                    "rendered_message": f"{mensagem}{extra_block}{link_block}",
                },
            )
        )

    async def emit_test(self, *, accountant_id: str, phone: str, mensagem: str) -> dict[str, Any]:
        return await self.emit(
            CommunicationEventCreate(
                event=CommunicationEventType.TEST_MESSAGE,
                accountant_id=accountant_id,
                priority=MessagePriority.HIGH,
                payload={
                    "phone": phone,
                    "mensagem": mensagem,
                    "rendered_message": mensagem,
                    "reminder_kind": "test",
                },
            )
        )

    async def dashboard(self, accountant_id: Optional[str] = None) -> dict[str, Any]:
        queue = await get_queue()
        qstats = await queue.stats()
        events = await self.events_repo.count_by_status(accountant_id)
        logs = await self.logs_repo.aggregate_stats(accountant_id)
        sent = logs.get("sent", {}).get("count", 0)
        failed = logs.get("failed", {}).get("count", 0)
        cancelled = logs.get("cancelled", {}).get("count", 0)
        total = sent + failed + cancelled
        success_rate = (sent / total * 100) if total else 0.0
        return {
            "queue": qstats,
            "events_by_status": events,
            "logs_by_status": logs,
            "success_rate": round(success_rate, 2),
            "templates": await self.templates_repo.list_all(),
            "recent_logs": await self.logs_repo.list_recent(accountant_id=accountant_id, limit=30),
        }


_center: Optional[CommunicationCenter] = None


def get_center() -> CommunicationCenter:
    if _center is None:
        raise RuntimeError("CommunicationCenter nao inicializado")
    return _center


def init_center(db: AsyncIOMotorDatabase) -> CommunicationCenter:
    global _center
    _center = CommunicationCenter(db)
    return _center
