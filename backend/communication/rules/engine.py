"""Motor de regras — valida antes de qualquer envio."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

from communication.circuit_breaker import CircuitBreaker
from communication.domain import OfficeCommSettings, RuleResult
from communication.providers.factory import get_communication_provider
from communication.rate_limiter import RateLimiter


def _parse_hhmm(value: str) -> tuple[int, int]:
    parts = (value or "08:00").strip().split(":")
    return int(parts[0]), int(parts[1]) if len(parts) > 1 else 0


def within_send_window(settings: OfficeCommSettings, when: Optional[datetime] = None) -> tuple[bool, Optional[datetime]]:
    """Retorna (permitido_agora, proximo_horario_se_fora)."""
    tz = ZoneInfo(settings.timezone or "America/Sao_Paulo")
    now = when.astimezone(tz) if when else datetime.now(tz)
    sh, sm = _parse_hhmm(settings.window_start)
    eh, em = _parse_hhmm(settings.window_end)
    start = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
    end = now.replace(hour=eh, minute=em, second=0, microsecond=0)
    if start <= now <= end:
        return True, None
    # Se antes da janela, agenda para o início; se depois, para o início do próximo dia
    if now < start:
        return False, start
    next_start = start
    from datetime import timedelta

    next_start = start + timedelta(days=1)
    return False, next_start


class RuleEngine:
    def __init__(
        self,
        rate_limiter: Optional[RateLimiter] = None,
        circuit_breaker: Optional[CircuitBreaker] = None,
    ) -> None:
        self.rate_limiter = rate_limiter or RateLimiter()
        self.circuit_breaker = circuit_breaker or CircuitBreaker()

    async def evaluate(
        self,
        *,
        settings: OfficeCommSettings,
        event: dict[str, Any],
        empresa: Optional[dict[str, Any]],
        accountant: Optional[dict[str, Any]],
        phone: Optional[str],
        template: Optional[dict[str, Any]],
        skip_window: bool = False,
    ) -> RuleResult:
        event_type = event.get("event")
        if settings.enabled_events and event_type not in settings.enabled_events:
            return RuleResult(allowed=False, reason="Evento desabilitado para o escritorio", code="EVENT_DISABLED")

        if self.circuit_breaker.is_open(settings.circuit_open_until):
            return RuleResult(
                allowed=False,
                reason=settings.circuit_reason or "Circuit breaker aberto",
                code="CIRCUIT_OPEN",
            )

        if not accountant:
            return RuleResult(allowed=False, reason="Contador nao encontrado", code="ACCOUNTANT_MISSING")
        if accountant.get("ativo") is False:
            return RuleResult(allowed=False, reason="Contador inativo", code="ACCOUNTANT_INACTIVE")
        if not accountant.get("whatsapp_conectado") or not accountant.get("whatsapp_session"):
            return RuleResult(
                allowed=False,
                reason="WhatsApp do escritorio nao conectado. Escaneie o QR em Notificacoes.",
                code="WA_NOT_CONNECTED",
            )

        if empresa is not None:
            if empresa.get("ativa") is False or empresa.get("ativo") is False:
                return RuleResult(allowed=False, reason="Empresa inativa", code="COMPANY_INACTIVE")
            if empresa.get("notificacoes_ativas") is False:
                return RuleResult(allowed=False, reason="Cliente bloqueou notificacoes", code="OPT_OUT")
            if empresa.get("notificacoes_whatsapp") is False:
                return RuleResult(allowed=False, reason="WhatsApp desabilitado para o cliente", code="WA_OPT_OUT")

        if not phone:
            return RuleResult(allowed=False, reason="Cliente sem telefone/WhatsApp", code="NO_PHONE")

        provider = get_communication_provider()
        ok, _, err = await provider.validate_number(phone)
        if not ok:
            return RuleResult(allowed=False, reason=err or "Numero invalido", code="INVALID_PHONE")

        if template is not None and not template.get("ativo", True):
            return RuleResult(allowed=False, reason="Template inativo", code="TEMPLATE_INACTIVE")

        if not skip_window:
            allowed_now, _ = within_send_window(settings)
            if not allowed_now:
                return RuleResult(allowed=False, reason="Fora da janela de envio", code="OUTSIDE_WINDOW")

        allowed_rate, rate_reason = await self.rate_limiter.allow(
            settings.accountant_id,
            max_per_hour=settings.max_per_hour,
            max_per_day=settings.max_per_day,
        )
        if not allowed_rate:
            return RuleResult(allowed=False, reason=rate_reason, code="RATE_LIMIT")

        return RuleResult(allowed=True)
