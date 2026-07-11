"""ApiBrasilProvider — única classe autorizada a falar com a APIBrasil."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any, Optional

import httpx

from communication.domain import SendResult
from communication.providers.base import CommunicationProvider

logger = logging.getLogger("communication.providers.apibrasil")


class ApiBrasilProvider(CommunicationProvider):
    name = "apibrasil"

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None

    def _gateway(self) -> str:
        base = os.getenv("APIBRASIL_GATEWAY_URL", "https://gateway.apibrasil.io").strip().rstrip("/")
        while base.lower().endswith("/api/v2"):
            base = base[: -len("/api/v2")].rstrip("/")
        return base or "https://gateway.apibrasil.io"

    def _headers(self) -> Optional[dict[str, str]]:
        bearer = os.getenv("APIBRASIL_BEARER_TOKEN", "").strip()
        device = os.getenv("APIBRASIL_DEVICE_TOKEN", "").strip()
        if not bearer or not device:
            return None
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {bearer}",
            "DeviceToken": device,
        }
        secret = os.getenv("APIBRASIL_SECRET_KEY", "").strip()
        public = os.getenv("APIBRASIL_PUBLIC_TOKEN", "").strip()
        if secret:
            headers["SecretKey"] = secret
        if public:
            headers["PublicToken"] = public
        return headers

    def configured(self) -> bool:
        return self._headers() is not None

    @staticmethod
    def _env_flag(name: str, default: bool = False) -> bool:
        raw = os.getenv(name)
        if raw is None or str(raw).strip() == "":
            return default
        return str(raw).strip().lower() in ("1", "true", "yes", "on")

    def _should_send_session(self) -> bool:
        """Default True: disparos usam o número pareado via QR."""
        return self._env_flag("APIBRASIL_SEND_SESSION", default=True)

    def _require_session(self) -> bool:
        """Default True: sem sessão do escritório, não envia."""
        return self._env_flag("APIBRASIL_REQUIRE_SESSION", default=True)

    async def _http(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=45.0)
        return self._client

    async def aclose(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    @staticmethod
    def normalize_br_phone(telefone: str) -> tuple[Optional[str], Optional[str]]:
        digits = re.sub(r"\D", "", telefone or "")
        if not digits:
            return None, "Telefone vazio"
        local = digits[2:] if digits.startswith("55") and len(digits) >= 12 else digits
        if len(local) not in (10, 11):
            return None, (
                "Numero invalido. Use DDD + celular (10 ou 11 digitos), "
                "com ou sem 55 na frente."
            )
        return f"55{local}", None

    @staticmethod
    def _success(status_code: int, data: Any) -> bool:
        if status_code < 200 or status_code >= 300:
            return False
        if not isinstance(data, dict):
            return True
        if data.get("error") is True:
            return False
        inner = data.get("response")
        if isinstance(inner, dict) and inner.get("response") is False:
            return False
        return True

    @staticmethod
    def _error_message(result: Any) -> str:
        if not isinstance(result, dict):
            return "Falha ao enviar (resposta invalida da APIBrasil)."
        raw = json.dumps(result, ensure_ascii=False, default=str).lower()
        if "msgchunks" in raw:
            return (
                "APIBrasil nao conseguiu enviar. Numero sem WhatsApp ou sessao dessincronizada."
            )
        inner = result.get("response")
        if isinstance(inner, dict):
            for key in ("message", "error", "erro", "msg", "data"):
                val = inner.get(key)
                if isinstance(val, str) and val.strip():
                    return val.strip()
        if isinstance(inner, str) and inner.strip():
            return inner.strip()
        if result.get("message"):
            return str(result["message"])
        return "Falha ao enviar via APIBrasil."

    @staticmethod
    def _extract_message_id(data: Any) -> Optional[str]:
        if not isinstance(data, dict):
            return None
        for key in ("id", "message_id", "messageId", "key"):
            val = data.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
            if isinstance(val, dict) and val.get("id"):
                return str(val["id"])
        inner = data.get("response")
        if isinstance(inner, dict):
            for key in ("id", "message_id", "messageId"):
                val = inner.get(key)
                if val:
                    return str(val)
        return None

    async def send_text(
        self,
        phone: str,
        text: str,
        *,
        session: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        headers = self._headers()
        if not headers:
            return SendResult(
                success=False,
                provider=self.name,
                error="APIBrasil nao configurada (APIBRASIL_BEARER_TOKEN / APIBRASIL_DEVICE_TOKEN).",
            )

        normalized, err = self.normalize_br_phone(phone)
        if err or not normalized:
            return SendResult(success=False, provider=self.name, error=err or "Telefone invalido")

        payload: dict[str, Any] = {
            "number": normalized,
            "text": text,
            "time_typing": 1,
        }
        # Por padrão SEMPRE envia a sessão do escritório (número que escaneou o QR).
        # Só desliga com APIBRASIL_SEND_SESSION=false.
        if session and self._should_send_session():
            payload["session"] = session
        elif not session and self._require_session():
            return SendResult(
                success=False,
                provider=self.name,
                error=(
                    "WhatsApp do escritorio nao conectado. "
                    "Abra Notificacoes e escaneie o QR Code com o celular do escritorio."
                ),
            )

        url = f"{self._gateway()}/api/v2/whatsapp/sendText"
        started = time.perf_counter()
        try:
            client = await self._http()
            response = await client.post(url, json=payload, headers=headers)
            try:
                data = response.json() if response.text else {}
            except ValueError:
                data = {"raw": response.text}
            ok = self._success(response.status_code, data)
            latency = (time.perf_counter() - started) * 1000
            return SendResult(
                success=ok,
                provider=self.name,
                provider_message_id=self._extract_message_id(data),
                phone=normalized,
                response=data,
                error=None if ok else self._error_message(data),
                latency_ms=latency,
            )
        except Exception as exc:
            logger.exception("APIBrasil sendText failed")
            return SendResult(
                success=False,
                provider=self.name,
                phone=normalized,
                error=str(exc),
                latency_ms=(time.perf_counter() - started) * 1000,
            )

    async def send_template(
        self,
        phone: str,
        template_name: str,
        variables: dict[str, Any],
        *,
        session: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        # APIBrasil free-text: templates são renderizados antes e enviados como texto.
        body = (metadata or {}).get("rendered_body") or template_name
        return await self.send_text(phone, str(body), session=session, metadata=metadata)

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
        text = caption or f"Documento: {filename or document_url}"
        if document_url:
            text = f"{text}\n{document_url}"
        return await self.send_text(phone, text, session=session, metadata=metadata)

    async def send_image(
        self,
        phone: str,
        image_url: str,
        *,
        caption: str = "",
        session: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        text = caption or "Imagem"
        if image_url:
            text = f"{text}\n{image_url}"
        return await self.send_text(phone, text, session=session, metadata=metadata)

    async def send_buttons(
        self,
        phone: str,
        text: str,
        buttons: list[dict[str, Any]],
        *,
        session: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        lines = [text]
        for i, btn in enumerate(buttons or [], start=1):
            label = btn.get("label") or btn.get("text") or f"Opcao {i}"
            lines.append(f"{i}) {label}")
        return await self.send_text(phone, "\n".join(lines), session=session, metadata=metadata)

    async def validate_number(self, phone: str) -> tuple[bool, Optional[str], Optional[str]]:
        normalized, err = self.normalize_br_phone(phone)
        if err:
            return False, None, err
        return True, normalized, None

    async def get_message_status(self, provider_message_id: str) -> dict[str, Any]:
        return {
            "provider": self.name,
            "provider_message_id": provider_message_id,
            "status": "unknown",
            "note": "APIBrasil sendText nao expoe status de entrega padronizado neste gateway.",
        }

    async def start_session(self, session: str) -> dict[str, Any]:
        """Inicia sessão e retorna QR (quando necessário)."""
        headers = self._headers()
        if not headers:
            return {
                "sucesso": False,
                "erro": "APIBrasil nao configurada (APIBRASIL_BEARER_TOKEN e APIBRASIL_DEVICE_TOKEN).",
            }
        url = f"{self._gateway()}/api/v2/whatsapp/start"
        payload = {
            "session": session,
            "qrcode": True,
            "device_name": f"GuiaControl-{session[-12:]}",
            "auto_close": 120000,
        }
        try:
            client = await self._http()
            response = await client.post(url, json=payload, headers=headers, timeout=120.0)
            try:
                data = response.json() if response.text else {}
            except ValueError:
                data = {"raw": response.text}
            ok = self._success(response.status_code, data)
            qr = self._extract_qr(data)
            conectado = self._payload_looks_connected(data)
            return {
                "sucesso": ok,
                "status_code": response.status_code,
                "session": session,
                "qrcode_data_uri": self._as_data_uri(qr) if qr else None,
                "conectado": conectado,
                "resposta": data,
                "erro": None if ok or qr else self._error_message(data),
            }
        except Exception as exc:
            logger.exception("APIBrasil start session failed")
            return {"sucesso": False, "erro": str(exc), "session": session}

    async def check_session_connected(self, session: str) -> tuple[bool, dict[str, Any]]:
        headers = self._headers()
        if not headers:
            return False, {"erro": "nao_configurado"}
        gateway = self._gateway()
        candidatos = [
            ("GET", f"{gateway}/api/v2/whatsapp/device", None),
            ("POST", f"{gateway}/api/v2/whatsapp/getConnectionState", {"session": session}),
            ("POST", f"{gateway}/api/v2/whatsapp/status", {"session": session}),
        ]
        ultimo: dict[str, Any] = {}
        client = await self._http()
        for method, url, body in candidatos:
            try:
                if method == "GET":
                    resp = await client.get(url, headers=headers, timeout=20.0)
                else:
                    resp = await client.post(url, json=body, headers=headers, timeout=20.0)
                try:
                    data = resp.json() if resp.text else {}
                except ValueError:
                    data = {"raw": resp.text}
                ultimo = {"url": url, "status_code": resp.status_code, "data": data}
                if not (200 <= resp.status_code < 300):
                    continue
                if self._session_connected_in_payload(session, data):
                    return True, ultimo
            except Exception as exc:
                ultimo = {"url": url, "erro": str(exc)}
        return False, ultimo

    async def logout_session(self, session: str) -> dict[str, Any]:
        """Tenta desconectar o aparelho na APIBrasil (best-effort)."""
        headers = self._headers()
        if not headers:
            return {"sucesso": False, "erro": "nao_configurado"}
        gateway = self._gateway()
        body = {"session": session}
        endpoints = [
            f"{gateway}/api/v2/whatsapp/logout",
            f"{gateway}/api/v2/whatsapp/close",
            f"{gateway}/api/v2/whatsapp/disconnect",
        ]
        client = await self._http()
        last: dict[str, Any] = {}
        for url in endpoints:
            try:
                resp = await client.post(url, json=body, headers=headers, timeout=30.0)
                try:
                    data = resp.json() if resp.text else {}
                except ValueError:
                    data = {"raw": resp.text}
                last = {"url": url, "status_code": resp.status_code, "data": data}
                if 200 <= resp.status_code < 300:
                    return {"sucesso": True, "endpoint": url, "resposta": data}
            except Exception as exc:
                last = {"url": url, "erro": str(exc)}
        return {"sucesso": False, "detalhes": last}

    @staticmethod
    def _extract_qr(payload: Any) -> Optional[str]:
        if not isinstance(payload, dict):
            return None

        def pick(obj: dict) -> Optional[str]:
            for key in ("qrcode", "base64", "qr", "qrCode", "qrcode_base64", "image"):
                val = obj.get(key)
                if isinstance(val, str) and val.strip():
                    return val.strip()
            return None

        found = pick(payload)
        if found:
            return found
        for nest in ("data", "response", "result", "device"):
            inner = payload.get(nest)
            if isinstance(inner, dict):
                found = pick(inner)
                if found:
                    return found
            elif isinstance(inner, str) and len(inner) > 80:
                return inner.strip()
        return None

    @staticmethod
    def _as_data_uri(qr: str) -> str:
        raw = qr.strip()
        if raw.startswith("data:image"):
            return raw
        return f"data:image/png;base64,{raw}"

    @staticmethod
    def _payload_looks_connected(data: Any) -> bool:
        if not isinstance(data, dict):
            return False
        st = str(data.get("status") or data.get("state") or "").lower()
        msg = str(data.get("message") or "").lower()
        if st in ("connected", "open", "online", "authenticated", "success"):
            return True
        if "connected" in msg or "conectad" in msg:
            return True
        return False

    @staticmethod
    def _session_connected_in_payload(session: str, data: Any) -> bool:
        if not isinstance(data, dict):
            return False
        blob = json.dumps(data, default=str).lower()
        if session.lower() in blob and any(
            s in blob for s in ("connected", "open", "online", "authenticated", "conectad")
        ):
            return True
        device = data.get("device")
        if isinstance(device, dict):
            st = str(device.get("status") or "").lower()
            if st not in ("disconnected", "offline", "closed", "close", "destroyed", "expired", ""):
                return True
        st = str(data.get("status") or data.get("state") or "").lower()
        return st in ("connected", "open", "online", "authenticated")
