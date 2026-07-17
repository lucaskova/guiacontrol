"""Worker — consome a fila e executa o fluxo completo de envio."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from communication.circuit_breaker import CircuitBreaker
from communication.delay import random_send_delay
from communication.domain import EventStatus, LogStatus, CommunicationEventType
from communication.providers.factory import get_communication_provider
from communication.queue.client import get_queue
from communication.rate_limiter import RateLimiter
from communication.repository import EventsRepository, LogsRepository
from communication.retry import max_attempts, next_retry_delay
from communication.rules.engine import RuleEngine, within_send_window
from communication.settings.service import SettingsService
from communication.templates.service import TemplateService

logger = logging.getLogger("communication.workers")

_IMMEDIATE_EVENTS = {
    CommunicationEventType.TEST_MESSAGE.value,
    CommunicationEventType.MANUAL_REMINDER.value,
}


class MessageWorker:
    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        events_repo: EventsRepository,
        logs_repo: LogsRepository,
        settings_service: SettingsService,
        template_service: TemplateService,
        rule_engine: RuleEngine,
        circuit_breaker: CircuitBreaker,
        worker_id: str = "worker-1",
    ) -> None:
        self.db = db
        self.events = events_repo
        self.logs = logs_repo
        self.settings = settings_service
        self.templates = template_service
        self.rules = rule_engine
        self.circuit = circuit_breaker
        self.worker_id = worker_id
        self._task: Optional[asyncio.Task] = None
        self._stopping = False

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stopping = False
        self._task = asyncio.create_task(self._loop(), name="communication-worker")
        logger.info("Communication worker iniciado (%s)", self.worker_id)

    async def stop(self) -> None:
        self._stopping = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self) -> None:
        queue = await get_queue()
        while not self._stopping:
            try:
                job = await queue.dequeue(timeout=2)
                if not job:
                    continue
                await self.process_job(job)
                await queue.ack(job.get("job_id", ""))
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Erro no loop do worker")
                await asyncio.sleep(1)

    async def process_job(self, job: dict[str, Any]) -> None:
        event_id = job.get("event_id")
        if not event_id:
            return
        event = await self.events.find_by_id(event_id)
        if not event:
            return
        if event.get("status") in (EventStatus.SENT.value, EventStatus.CANCELLED.value):
            return

        await self.events.update(event_id, status=EventStatus.PROCESSING.value)
        accountant_id = event.get("accountant_id")
        settings = await self.settings.get(accountant_id)
        event_name = event.get("event")
        immediate = event_name in _IMMEDIATE_EVENTS

        # Re-checa janela no momento do processamento (exceto teste/manual)
        if not immediate:
            allowed_now, next_slot = within_send_window(settings)
            if not allowed_now and next_slot is not None:
                from datetime import timezone as tz

                now = datetime.now(tz.utc)
                slot = next_slot
                if slot.tzinfo is None:
                    from zoneinfo import ZoneInfo

                    slot = slot.replace(tzinfo=ZoneInfo(settings.timezone))
                delay = max(0.0, (slot.astimezone(tz.utc) - now).total_seconds())
                delay += random_send_delay(settings.delay_min_seconds, settings.delay_max_seconds)
                queue = await get_queue()
                await queue.enqueue({"event_id": event_id, "accountant_id": accountant_id}, delay_seconds=delay)
                await self.events.update(
                    event_id,
                    status=EventStatus.SCHEDULED.value,
                    scheduled_for=slot.astimezone(tz.utc),
                )
                await self.logs.create(
                    {
                        "event_id": event_id,
                        "accountant_id": accountant_id,
                        "status": LogStatus.DELAYED.value,
                        "error": "Reagendado: fora da janela",
                        "worker": self.worker_id,
                        "delay_seconds": delay,
                    }
                )
                return

        payload = event.get("payload") or {}
        empresa_id = event.get("company_id") or payload.get("empresa_id") or ""
        empresa = await self.db.empresas.find_one({"empresa_id": empresa_id}) if empresa_id else None
        accountant = await self.db.users.find_one({"user_id": accountant_id}, {"_id": 0, "password_hash": 0})

        phone = (
            payload.get("phone")
            or payload.get("telefone")
            or (empresa or {}).get("whatsapp")
            or (empresa or {}).get("telefone")
        )

        template = await self.templates.pick(
            event.get("event"),
            language=settings.language,
            active_ids=settings.active_template_ids or None,
        )

        # Mensagem pré-renderizada (manual/test) tem prioridade
        rendered = payload.get("rendered_message")
        if not rendered:
            variables = {
                "nome": payload.get("nome") or (empresa or {}).get("nome_fantasia") or (empresa or {}).get("razao_social") or "",
                "empresa": (empresa or {}).get("nome_fantasia") or (empresa or {}).get("razao_social") or "",
                "competencia": payload.get("tipo") or payload.get("competencia") or "Guia",
                "valor": payload.get("valor_fmt") or payload.get("valor") or "",
                "vencimento": payload.get("vencimento_fmt") or payload.get("vencimento") or "",
                "contador": (accountant or {}).get("name") or "",
                "telefone": phone or "",
                "link": payload.get("link") or "",
                "mensagem": payload.get("mensagem") or "",
                "extra_block": payload.get("extra_block") or "",
                "link_block": payload.get("link_block") or "",
            }
            if template:
                rendered = self.templates.render(template, variables)
            else:
                rendered = variables.get("mensagem") or "Notificacao GuiaControl"

        rule = await self.rules.evaluate(
            settings=settings,
            event=event,
            empresa=empresa,
            accountant=accountant,
            phone=phone,
            template=template,
            skip_window=True,  # já checado acima
        )
        if not rule.allowed:
            # Rate limit / circuit: reagendar em vez de cancelar definitivamente
            if rule.code in ("RATE_LIMIT", "CIRCUIT_OPEN"):
                delay = float(next_retry_delay(1) or 300)
                queue = await get_queue()
                await queue.enqueue(
                    {"event_id": event_id, "accountant_id": accountant_id},
                    delay_seconds=delay,
                )
                await self.events.update(
                    event_id,
                    status=EventStatus.SCHEDULED.value,
                    next_retry=datetime.fromtimestamp(
                        datetime.now(timezone.utc).timestamp() + delay, tz=timezone.utc
                    ),
                )
                await self.logs.create(
                    {
                        "event_id": event_id,
                        "accountant_id": accountant_id,
                        "phone": phone,
                        "status": LogStatus.DELAYED.value,
                        "error": rule.reason,
                        "code": rule.code,
                        "worker": self.worker_id,
                        "delay_seconds": delay,
                    }
                )
                return

            await self.events.update(
                event_id,
                status=EventStatus.CANCELLED.value,
                cancel_reason=rule.reason,
                processed_at=datetime.now(timezone.utc),
            )
            await self.logs.create(
                {
                    "event_id": event_id,
                    "accountant_id": accountant_id,
                    "phone": phone,
                    "template": (template or {}).get("id"),
                    "status": LogStatus.CANCELLED.value,
                    "error": rule.reason,
                    "code": rule.code,
                    "worker": self.worker_id,
                }
            )
            # Compat: também grava no histórico legado
            await self._legacy_notif(event, phone, rendered or "", {"sucesso": False, "erro": rule.reason}, False)
            return

        session = None
        if accountant and accountant.get("whatsapp_conectado") and accountant.get("whatsapp_session"):
            session = accountant.get("whatsapp_session")
        if not session:
            reason = "WhatsApp do escritorio nao conectado. Escaneie o QR em Notificacoes."
            await self.events.update(
                event_id,
                status=EventStatus.CANCELLED.value,
                cancel_reason=reason,
                processed_at=datetime.now(timezone.utc),
            )
            await self.logs.create(
                {
                    "event_id": event_id,
                    "accountant_id": accountant_id,
                    "phone": phone,
                    "status": LogStatus.CANCELLED.value,
                    "error": reason,
                    "code": "WA_NOT_CONNECTED",
                    "worker": self.worker_id,
                }
            )
            await self._legacy_notif(event, phone, rendered or "", {"sucesso": False, "erro": reason}, False)
            return

        provider = get_communication_provider()
        # Confirma sessão ao vivo antes do envio (evita disparar com flag local stale)
        if hasattr(provider, "check_session_connected"):
            live, det = await provider.check_session_connected(session)
            if not live:
                await self.db.users.update_one(
                    {"user_id": accountant_id},
                    {
                        "$set": {
                            "whatsapp_conectado": False,
                            "whatsapp_updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
                )
                reason = "Sessao WhatsApp do escritorio offline. Gere um novo QR em Notificacoes."
                await self.events.update(
                    event_id,
                    status=EventStatus.CANCELLED.value,
                    cancel_reason=reason,
                    processed_at=datetime.now(timezone.utc),
                )
                await self.logs.create(
                    {
                        "event_id": event_id,
                        "accountant_id": accountant_id,
                        "phone": phone,
                        "status": LogStatus.CANCELLED.value,
                        "error": reason,
                        "code": "WA_SESSION_OFFLINE",
                        "response": det,
                        "worker": self.worker_id,
                    }
                )
                await self._legacy_notif(event, phone, rendered or "", {"sucesso": False, "erro": reason, "detalhes": det}, False)
                return

        log = await self.logs.create(
            {
                "event_id": event_id,
                "accountant_id": accountant_id,
                "company_id": empresa_id,
                "phone": phone,
                "provider": provider.name,
                "template": (template or {}).get("id"),
                "status": LogStatus.SENDING.value,
                "worker": self.worker_id,
                "message_preview": (rendered or "")[:500],
                "queued_at": event.get("created_at"),
                "whatsapp_session": session,
            }
        )

        result = await provider.send_text(phone, rendered or "", session=session)
        now = datetime.now(timezone.utc)

        if result.success:
            self.circuit.record_success(accountant_id)
            if settings.circuit_open_until:
                await self.settings.update(accountant_id, {"circuit_open_until": None, "circuit_reason": None})
            await self.events.update(
                event_id,
                status=EventStatus.SENT.value,
                processed_at=now,
                attempts=int(event.get("attempts") or 0) + 1,
            )
            await self.logs.update(
                log["id"],
                status=LogStatus.SENT.value,
                sent_at=now,
                provider_message_id=result.provider_message_id,
                response=result.response,
                latency_ms=result.latency_ms,
            )
            await self._legacy_notif(event, phone, rendered or "", result.model_dump(), True)
            return

        attempts = int(event.get("attempts") or 0) + 1
        failures = self.circuit.record_failure(accountant_id)
        if self.circuit.should_open(accountant_id):
            until = self.circuit.open_until()
            await self.settings.update(
                accountant_id,
                {
                    "circuit_open_until": until,
                    "circuit_reason": f"Falhas consecutivas no provider ({failures})",
                },
            )

        retry_in = next_retry_delay(attempts)
        await self.logs.update(
            log["id"],
            status=LogStatus.FAILED.value,
            error=result.error,
            response=result.response,
            latency_ms=result.latency_ms,
            sent_at=now,
        )
        await self._legacy_notif(event, phone, rendered or "", result.model_dump(), False)

        if retry_in is None or attempts > max_attempts():
            await self.events.update(
                event_id,
                status=EventStatus.FAILED.value,
                attempts=attempts,
                processed_at=now,
                cancel_reason=result.error,
            )
            return

        await self.events.update(
            event_id,
            status=EventStatus.RETRYING.value,
            attempts=attempts,
            next_retry=datetime.fromtimestamp(now.timestamp() + retry_in, tz=timezone.utc),
        )
        queue = await get_queue()
        await queue.enqueue(
            {"event_id": event_id, "accountant_id": accountant_id},
            delay_seconds=float(retry_in),
        )

    async def _legacy_notif(
        self,
        event: dict[str, Any],
        phone: Optional[str],
        message: str,
        resultado: dict[str, Any],
        sucesso: bool,
    ) -> None:
        """Mantém compatibilidade com a collection notificacoes / UI atual."""
        import uuid

        payload = event.get("payload") or {}
        doc = {
            "notificacao_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": event.get("accountant_id"),
            "empresa_id": event.get("company_id") or payload.get("empresa_id") or "",
            "guia_id": payload.get("guia_id") or "",
            "canal": "whatsapp",
            "destinatario": phone or "",
            "mensagem": message,
            "sucesso": sucesso if "sucesso" not in resultado else bool(resultado.get("sucesso")),
            "detalhes": resultado,
            "reminder_kind": payload.get("reminder_kind"),
            "communication_event_id": event.get("id"),
            "created_at": datetime.now(timezone.utc),
        }
        await self.db.notificacoes.insert_one(doc)
