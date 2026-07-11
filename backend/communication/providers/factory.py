"""Factory do CommunicationProvider — troca de provedor via env."""

from __future__ import annotations

import os
from functools import lru_cache

from communication.providers.apibrasil import ApiBrasilProvider
from communication.providers.base import CommunicationProvider


@lru_cache(maxsize=1)
def get_communication_provider() -> CommunicationProvider:
    name = (os.getenv("WHATSAPP_PROVIDER") or "apibrasil").strip().lower()
    if name in ("apibrasil", "api_brasil", "api-brasil"):
        return ApiBrasilProvider()
    # Futuro: whatsapp_cloud, evolution, twilio
    return ApiBrasilProvider()


def reset_provider_cache() -> None:
    get_communication_provider.cache_clear()
