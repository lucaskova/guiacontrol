"""Rotas HTTP do CommunicationCenter (dashboard, settings, templates, events)."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Cookie, Header, HTTPException
from pydantic import BaseModel, Field

from communication.domain import CommunicationEventCreate, CommunicationEventType, MessagePriority
from communication.service import get_center


def build_communication_router(get_current_user, is_admin_email=None) -> APIRouter:
    router = APIRouter(prefix="/api/communication", tags=["communication"])

    class EmitBody(BaseModel):
        event: CommunicationEventType
        company_id: str = ""
        client_id: str = ""
        priority: MessagePriority = MessagePriority.NORMAL
        payload: dict[str, Any] = Field(default_factory=dict)
        dedupe_key: Optional[str] = None

    class SettingsPatch(BaseModel):
        window_start: Optional[str] = None
        window_end: Optional[str] = None
        timezone: Optional[str] = None
        max_per_hour: Optional[int] = None
        max_per_day: Optional[int] = None
        delay_min_seconds: Optional[int] = None
        delay_max_seconds: Optional[int] = None
        enabled_events: Optional[list[str]] = None
        active_template_ids: Optional[list[str]] = None
        whatsapp_number: Optional[str] = None
        language: Optional[str] = None

    @router.get("/dashboard")
    async def dashboard(
        session_token: Optional[str] = Cookie(None),
        authorization: Optional[str] = Header(None),
    ):
        user = await get_current_user(session_token, authorization)
        center = get_center()
        return await center.dashboard(user["user_id"])

    @router.get("/dashboard/admin")
    async def dashboard_admin(
        session_token: Optional[str] = Cookie(None),
        authorization: Optional[str] = Header(None),
    ):
        user = await get_current_user(session_token, authorization)
        if is_admin_email and not is_admin_email(user.get("email")):
            raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
        center = get_center()
        return await center.dashboard(None)

    @router.get("/settings")
    async def get_settings(
        session_token: Optional[str] = Cookie(None),
        authorization: Optional[str] = Header(None),
    ):
        user = await get_current_user(session_token, authorization)
        center = get_center()
        settings = await center.settings.get(user["user_id"])
        return settings.model_dump()

    @router.patch("/settings")
    async def patch_settings(
        body: SettingsPatch,
        session_token: Optional[str] = Cookie(None),
        authorization: Optional[str] = Header(None),
    ):
        user = await get_current_user(session_token, authorization)
        center = get_center()
        updated = await center.settings.update(
            user["user_id"],
            body.model_dump(exclude_unset=True),
        )
        return updated.model_dump()

    @router.get("/templates")
    async def list_templates(
        session_token: Optional[str] = Cookie(None),
        authorization: Optional[str] = Header(None),
    ):
        await get_current_user(session_token, authorization)
        center = get_center()
        return await center.templates_repo.list_all()

    @router.get("/events")
    async def list_events(
        session_token: Optional[str] = Cookie(None),
        authorization: Optional[str] = Header(None),
        limit: int = 50,
    ):
        user = await get_current_user(session_token, authorization)
        center = get_center()
        docs = (
            await center.events_repo.col.find({"accountant_id": user["user_id"]}, {"_id": 0})
            .sort("created_at", -1)
            .to_list(min(limit, 200))
        )
        return docs

    @router.get("/logs")
    async def list_logs(
        session_token: Optional[str] = Cookie(None),
        authorization: Optional[str] = Header(None),
        limit: int = 50,
    ):
        user = await get_current_user(session_token, authorization)
        center = get_center()
        return await center.logs_repo.list_recent(accountant_id=user["user_id"], limit=min(limit, 200))

    @router.get("/queue")
    async def queue_stats(
        session_token: Optional[str] = Cookie(None),
        authorization: Optional[str] = Header(None),
    ):
        await get_current_user(session_token, authorization)
        from communication.queue.client import get_queue

        queue = await get_queue()
        return await queue.stats()

    @router.post("/events")
    async def emit_event(
        body: EmitBody,
        session_token: Optional[str] = Cookie(None),
        authorization: Optional[str] = Header(None),
    ):
        user = await get_current_user(session_token, authorization)
        center = get_center()
        return await center.emit(
            CommunicationEventCreate(
                event=body.event,
                company_id=body.company_id,
                accountant_id=user["user_id"],
                client_id=body.client_id or body.company_id,
                priority=body.priority,
                payload=body.payload,
                dedupe_key=body.dedupe_key,
            )
        )

    @router.get("/health")
    async def comm_health():
        from communication.queue.client import get_queue
        from communication.providers.factory import get_communication_provider

        queue = await get_queue()
        provider = get_communication_provider()
        return {
            "status": "ok",
            "queue": await queue.stats(),
            "provider": provider.name,
            "provider_configured": getattr(provider, "configured", lambda: True)(),
        }

    return router
