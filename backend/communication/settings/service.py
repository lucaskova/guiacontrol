"""Serviço de settings por escritório."""

from __future__ import annotations

from typing import Any

from communication.domain import OfficeCommSettings
from communication.repository import SettingsRepository
from communication.settings.defaults import default_office_settings


class SettingsService:
    def __init__(self, repo: SettingsRepository) -> None:
        self.repo = repo

    async def get(self, accountant_id: str) -> OfficeCommSettings:
        doc = await self.repo.get(accountant_id)
        if not doc:
            base = default_office_settings(accountant_id)
            await self.repo.upsert(accountant_id, base.model_dump())
            return base
        return OfficeCommSettings(**{k: v for k, v in doc.items() if k in OfficeCommSettings.model_fields})

    async def update(self, accountant_id: str, patch: dict[str, Any]) -> OfficeCommSettings:
        current = await self.get(accountant_id)
        data = current.model_dump()
        allowed = set(OfficeCommSettings.model_fields.keys()) - {"accountant_id"}
        for k, v in patch.items():
            if k in allowed and v is not None:
                data[k] = v
        saved = await self.repo.upsert(accountant_id, data)
        return OfficeCommSettings(**{k: v for k, v in saved.items() if k in OfficeCommSettings.model_fields})
