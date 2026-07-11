"""Retry inteligente com backoff fixo (não infinito)."""

from __future__ import annotations

from typing import Optional

# minutos → segundos
RETRY_SCHEDULE_SECONDS = [
    5 * 60,
    15 * 60,
    30 * 60,
    60 * 60,
]


def next_retry_delay(attempts: int) -> Optional[int]:
    """attempts é 1-based após a falha atual. None = cancelar definitivamente."""
    idx = attempts - 1
    if idx < 0 or idx >= len(RETRY_SCHEDULE_SECONDS):
        return None
    return RETRY_SCHEDULE_SECONDS[idx]


def max_attempts() -> int:
    return len(RETRY_SCHEDULE_SECONDS)
