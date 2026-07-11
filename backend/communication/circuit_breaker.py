"""Circuit breaker por escritório — isola falhas da APIBrasil."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, open_seconds: int = 900) -> None:
        self.failure_threshold = failure_threshold
        self.open_seconds = open_seconds
        self._failures: dict[str, int] = {}

    def record_success(self, accountant_id: str) -> None:
        self._failures[accountant_id] = 0

    def record_failure(self, accountant_id: str) -> int:
        self._failures[accountant_id] = self._failures.get(accountant_id, 0) + 1
        return self._failures[accountant_id]

    def should_open(self, accountant_id: str) -> bool:
        return self._failures.get(accountant_id, 0) >= self.failure_threshold

    def open_until(self) -> datetime:
        return datetime.now(timezone.utc) + timedelta(seconds=self.open_seconds)

    def is_open(self, open_until: Optional[datetime]) -> bool:
        if not open_until:
            return False
        if open_until.tzinfo is None:
            open_until = open_until.replace(tzinfo=timezone.utc)
        return open_until > datetime.now(timezone.utc)
