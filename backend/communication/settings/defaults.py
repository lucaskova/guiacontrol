"""Configurações padrão por escritório."""

from __future__ import annotations

from communication.domain import CommunicationEventType, OfficeCommSettings


DEFAULT_ENABLED_EVENTS = [
    CommunicationEventType.GUIDE_DUE_IN_7_DAYS.value,
    CommunicationEventType.GUIDE_DUE_IN_3_DAYS.value,
    CommunicationEventType.GUIDE_DUE_TODAY.value,
    CommunicationEventType.GUIDE_OVERDUE.value,
    CommunicationEventType.MANUAL_REMINDER.value,
    CommunicationEventType.GUIDE_CREATED.value,
    CommunicationEventType.TEST_MESSAGE.value,
]


def default_office_settings(accountant_id: str) -> OfficeCommSettings:
    return OfficeCommSettings(
        accountant_id=accountant_id,
        window_start="08:00",
        window_end="18:00",
        timezone="America/Sao_Paulo",
        max_per_hour=40,
        max_per_day=200,
        delay_min_seconds=30,
        delay_max_seconds=120,
        enabled_events=list(DEFAULT_ENABLED_EVENTS),
        active_template_ids=[],
        language="pt-BR",
    )
