"""Modelos de domínio e enums do CommunicationCenter."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class CommunicationEventType(str, Enum):
    GUIDE_CREATED = "GUIDE_CREATED"
    GUIDE_UPDATED = "GUIDE_UPDATED"
    GUIDE_DUE_TOMORROW = "GUIDE_DUE_TOMORROW"
    GUIDE_DUE_TODAY = "GUIDE_DUE_TODAY"
    GUIDE_OVERDUE = "GUIDE_OVERDUE"
    GUIDE_PAID = "GUIDE_PAID"
    GUIDE_DUE_IN_7_DAYS = "GUIDE_DUE_IN_7_DAYS"
    GUIDE_DUE_IN_3_DAYS = "GUIDE_DUE_IN_3_DAYS"
    DOCUMENT_AVAILABLE = "DOCUMENT_AVAILABLE"
    CLIENT_CREATED = "CLIENT_CREATED"
    COMPANY_CREATED = "COMPANY_CREATED"
    ACCOUNTANT_NOTIFICATION = "ACCOUNTANT_NOTIFICATION"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    MANUAL_REMINDER = "MANUAL_REMINDER"
    TEST_MESSAGE = "TEST_MESSAGE"


class EventStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    SCHEDULED = "scheduled"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class MessagePriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class LogStatus(str, Enum):
    QUEUED = "queued"
    DELAYED = "delayed"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class CommunicationEventCreate(BaseModel):
    event: CommunicationEventType
    company_id: str = ""
    accountant_id: str
    client_id: str = ""
    priority: MessagePriority = MessagePriority.NORMAL
    payload: dict[str, Any] = Field(default_factory=dict)
    dedupe_key: Optional[str] = None


class CommunicationEventDoc(BaseModel):
    id: str
    company_id: str = ""
    accountant_id: str
    client_id: str = ""
    event: str
    payload: dict[str, Any] = Field(default_factory=dict)
    status: EventStatus = EventStatus.PENDING
    attempts: int = 0
    priority: MessagePriority = MessagePriority.NORMAL
    dedupe_key: Optional[str] = None
    cancel_reason: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None
    next_retry: Optional[datetime] = None
    scheduled_for: Optional[datetime] = None


class OfficeCommSettings(BaseModel):
    accountant_id: str
    window_start: str = "08:00"
    window_end: str = "18:00"
    timezone: str = "America/Sao_Paulo"
    max_per_hour: int = 40
    max_per_day: int = 200
    delay_min_seconds: int = 30
    delay_max_seconds: int = 120
    enabled_events: list[str] = Field(default_factory=list)
    active_template_ids: list[str] = Field(default_factory=list)
    whatsapp_number: str = ""
    language: str = "pt-BR"
    circuit_open_until: Optional[datetime] = None
    circuit_reason: Optional[str] = None
    updated_at: Optional[datetime] = None


class TemplateDoc(BaseModel):
    id: str
    nome: str
    categoria: str
    ativo: bool = True
    idioma: str = "pt-BR"
    corpo: str
    variaveis: list[str] = Field(default_factory=list)
    botoes: list[dict[str, Any]] = Field(default_factory=list)
    event_types: list[str] = Field(default_factory=list)


class SendResult(BaseModel):
    success: bool
    provider: str = "apibrasil"
    provider_message_id: Optional[str] = None
    phone: Optional[str] = None
    response: Any = None
    error: Optional[str] = None
    latency_ms: Optional[float] = None


class RuleResult(BaseModel):
    allowed: bool
    reason: Optional[str] = None
    code: Optional[str] = None
