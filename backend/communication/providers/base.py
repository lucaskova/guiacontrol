"""Interface CommunicationProvider — desacopla transporte da regra de negócio."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional

from communication.domain import SendResult


class CommunicationProvider(ABC):
    """Contrato único para qualquer provedor de WhatsApp/comunicação."""

    name: str = "base"

    @abstractmethod
    async def send_text(
        self,
        phone: str,
        text: str,
        *,
        session: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        ...

    @abstractmethod
    async def send_template(
        self,
        phone: str,
        template_name: str,
        variables: dict[str, Any],
        *,
        session: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        ...

    @abstractmethod
    async def send_document(
        self,
        phone: str,
        document_url: str,
        *,
        caption: str = "",
        filename: str = "",
        session: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        ...

    @abstractmethod
    async def send_image(
        self,
        phone: str,
        image_url: str,
        *,
        caption: str = "",
        session: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        ...

    @abstractmethod
    async def send_buttons(
        self,
        phone: str,
        text: str,
        buttons: list[dict[str, Any]],
        *,
        session: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        ...

    @abstractmethod
    async def validate_number(self, phone: str) -> tuple[bool, Optional[str], Optional[str]]:
        """Retorna (válido, número_normalizado, erro)."""
        ...

    @abstractmethod
    async def get_message_status(self, provider_message_id: str) -> dict[str, Any]:
        ...
