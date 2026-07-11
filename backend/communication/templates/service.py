"""Renderização e seleção de templates."""

from __future__ import annotations

import random
import re
from typing import Any, Optional

from communication.repository import TemplatesRepository

VAR_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def render_template(body: str, variables: dict[str, Any]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        val = variables.get(key)
        return "" if val is None else str(val)

    return VAR_PATTERN.sub(repl, body or "")


class TemplateService:
    def __init__(self, repo: TemplatesRepository) -> None:
        self.repo = repo
        self._rr_counters: dict[str, int] = {}

    async def pick(
        self,
        event_type: str,
        *,
        language: str = "pt-BR",
        active_ids: Optional[list[str]] = None,
    ) -> Optional[dict[str, Any]]:
        templates = await self.repo.list_active(
            event_type=event_type,
            idioma=language,
            ids=active_ids or None,
        )
        if not templates:
            templates = await self.repo.list_active(event_type=event_type, idioma=language)
        if not templates:
            return None
        # Alternância: round-robin + shuffle leve anti-spam
        key = f"{event_type}:{language}"
        idx = self._rr_counters.get(key, 0) % len(templates)
        self._rr_counters[key] = idx + 1
        if len(templates) > 1 and random.random() < 0.35:
            idx = random.randrange(len(templates))
        return templates[idx]

    def render(self, template: dict[str, Any], variables: dict[str, Any]) -> str:
        return render_template(template.get("corpo", ""), variables)
