"""Delay aleatório inteligente — nunca fixo."""

from __future__ import annotations

import random


def random_send_delay(min_seconds: int = 30, max_seconds: int = 120) -> float:
    lo = max(0, int(min_seconds))
    hi = max(lo, int(max_seconds))
    # Distribuição uniforme contínua para evitar padrões detectáveis
    return random.uniform(lo, hi)
