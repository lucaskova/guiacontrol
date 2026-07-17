from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Response, Header, Body, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any
import uuid
import secrets
from datetime import datetime, timezone, timedelta, date
from zoneinfo import ZoneInfo
import httpx
import re
import base64
import requests
import io
from PIL import Image

from communication.domain import CommunicationEventType
from communication.router import build_communication_router
from communication.service import get_center, init_center

# Imports opcionais para decodificação de QR Code/Barcode.
# Usamos Exception aqui porque pyzbar/cv2 podem falhar com FileNotFoundError
# (DLL ausente no Windows) e isso não pode derrubar o servidor.
try:
    from pyzbar.pyzbar import decode as pyzbar_decode
    from pyzbar.pyzbar import ZBarSymbol
    PYZBAR_AVAILABLE = True
except Exception as _pyzbar_err:
    PYZBAR_AVAILABLE = False
    pyzbar_decode = None
    logging.getLogger(__name__).warning(
        "pyzbar indisponivel (%s) - leitura de QR vai usar zxing/cv2.",
        _pyzbar_err,
    )

try:
    import zxingcpp
    ZXING_AVAILABLE = True
except Exception as _zxing_err:
    ZXING_AVAILABLE = False
    zxingcpp = None
    logging.getLogger(__name__).warning("zxing-cpp indisponivel (%s).", _zxing_err)

try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except Exception as _cv2_err:
    CV2_AVAILABLE = False
    cv2 = None
    np = None
    logging.getLogger(__name__).warning("OpenCV/numpy indisponivel (%s).", _cv2_err)

import fitz  # PyMuPDF
import bcrypt
from urllib.parse import quote_plus, unquote_plus

from ocr_lote import (
    analisar_itens_lote,
    detectar_duplicidade,
    extrair_cnpj_do_texto,
    extrair_codigo_barras,
    extrair_dados_guia,
    extrair_qr_code_pix,
    hash_arquivo_base64,
    normalizar_data_iso,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


def _normalize_mongo_url(url: str) -> str:
    """
    Codifica usuario/senha na URI (RFC 3986).
    Senhas com @, #, <, > etc. quebram mongodb+srv://user:pass@host se nao estiverem encoded.
    """
    raw = url.strip().strip('"').strip("'")
    if not raw.startswith(("mongodb://", "mongodb+srv://")):
        return raw
    scheme_end = raw.index("://") + 3
    authority = raw[scheme_end:]
    at_idx = authority.rfind("@")
    if at_idx < 0:
        return raw
    userinfo, hostpart = authority[:at_idx], authority[at_idx + 1 :]
    if ":" in userinfo:
        user, password = userinfo.split(":", 1)
        user = quote_plus(unquote_plus(user), safe="")
        password = quote_plus(unquote_plus(password), safe="")
        userinfo = f"{user}:{password}"
    else:
        userinfo = quote_plus(unquote_plus(userinfo), safe="")
    return f"{raw[:scheme_end]}{userinfo}@{hostpart}"

# Configure logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = _normalize_mongo_url(os.environ["MONGO_URL"])
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def _cors_allow_origins() -> list[str]:
    """
    Lista explícita de origens para CORS com credentials.
    Não use '*' com allow_credentials=True: o navegador bloqueia a leitura da resposta
    (cadastro/login parecem falhar com erro genérico no app web).
    """
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if raw:
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if parts:
            return parts
    return [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]


def _cors_allow_origin_regex() -> Optional[str]:
    """
    Origens automaticamente permitidas:
    - localhost / 127.0.0.1 / IPs da rede local (dev)
    - Qualquer subdomínio *.vercel.app (produção do app e da landing)
    - Qualquer subdomínio *.onrender.com (preview)
    Desative com CORS_DISABLE_DEV_REGEX=1 em produção estrita (use só CORS_ALLOW_ORIGINS).
    """
    if os.getenv("CORS_DISABLE_DEV_REGEX", "").lower() in ("1", "true", "yes"):
        return None
    custom = os.getenv("CORS_ALLOW_ORIGIN_REGEX", "").strip()
    if custom:
        return custom
    return (
        r"^https?://("
        r"localhost|127\.0\.0\.1|\[::1\]"
        r"|192\.168\.\d{1,3}\.\d{1,3}"
        r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}"
        r"|([a-zA-Z0-9-]+\.)*vercel\.app"
        r"|([a-zA-Z0-9-]+\.)*onrender\.com"
        r")(:\d+)?$"
    )


# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ============ MODELS ============

class User(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None
    created_at: datetime

class UserSession(BaseModel):
    session_token: str
    user_id: str
    expires_at: datetime
    created_at: datetime

class Empresa(BaseModel):
    empresa_id: str
    user_id: str
    cnpj: str
    razao_social: str
    nome_fantasia: Optional[str] = None
    dados_completos: Optional[dict] = None
    created_at: datetime

class EmpresaCreate(BaseModel):
    cnpj: str

class EmpresaUpdate(BaseModel):
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    notificacoes_ativas: Optional[bool] = None
    notificacoes_whatsapp: Optional[bool] = None
    notificacoes_email: Optional[bool] = None

class Guia(BaseModel):
    guia_id: str
    user_id: str
    empresa_id: str
    tipo: str  # DAS, DARF, ICMS, ISS, etc
    descricao: str
    valor: float
    data_vencimento: str  # YYYY-MM-DD
    status: str  # a_vencer, vencida, paga
    codigo_barras: Optional[str] = None
    qr_code_pix: Optional[str] = None
    observacoes: Optional[str] = None
    data_pagamento: Optional[str] = None
    comprovante: Optional[str] = None  # base64
    arquivo_guia: Optional[str] = None  # base64 do arquivo da guia original
    nome_arquivo_guia: Optional[str] = None  # nome do arquivo
    tipo_arquivo_guia: Optional[str] = None  # PDF, JPG, PNG
    created_at: datetime
    updated_at: datetime

class GuiaCreate(BaseModel):
    empresa_id: str
    tipo: str
    descricao: str
    valor: float
    data_vencimento: str
    codigo_barras: Optional[str] = None
    qr_code_pix: Optional[str] = None
    observacoes: Optional[str] = None
    competencia: Optional[str] = None
    arquivo_guia: Optional[str] = None  # Base64 do arquivo da guia

class GuiaUpdate(BaseModel):
    tipo: Optional[str] = None
    descricao: Optional[str] = None
    valor: Optional[float] = None
    data_vencimento: Optional[str] = None
    codigo_barras: Optional[str] = None
    qr_code_pix: Optional[str] = None
    observacoes: Optional[str] = None
    status: Optional[str] = None
    data_pagamento: Optional[str] = None
    comprovante: Optional[str] = None

class DashboardStats(BaseModel):
    total_guias: int
    guias_pagas: int
    guias_vencidas: int
    guias_a_vencer: int
    valor_total_pago: float
    valor_total_vencido: float
    valor_total_a_vencer: float


class DashboardAlert(BaseModel):
    id: str
    severity: str  # info | warning | success
    icon: str
    message: str


class DashboardInsights(BaseModel):
    widgets: dict
    pendencias: dict
    alerts: List[DashboardAlert]
    chart_status: List[dict]
    chart_monthly: List[dict]
    empresas_insights: dict
    automation_tagline: str = "O contador sobe a guia e o GuiaControl faz o resto."


class AuthRegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=2, max_length=120)


class AuthLoginBody(BaseModel):
    email: EmailStr
    password: str


class ComprovanteUpload(BaseModel):
    comprovante: Optional[str] = None  # base64 do comprovante (data URL)


# ============ HELPER FUNCTIONS ============


def _auth_cookie_secure() -> bool:
    return os.getenv("AUTH_COOKIE_SECURE", "").lower() in ("1", "true", "yes")


def _auth_cookie_samesite() -> str:
    return "none" if _auth_cookie_secure() else "lax"


def _strip_user(user_doc: Optional[dict]) -> Optional[dict]:
    if not user_doc:
        return user_doc
    return {k: v for k, v in user_doc.items() if k not in ("_id", "password_hash")}


async def _commit_session(user_id: str, response: Response) -> tuple[str, dict]:
    """Cria sessão no Mongo, define cookie HttpOnly e devolve token + usuário (sem senha)."""
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    }
    await db.user_sessions.insert_one(session_doc)
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=_auth_cookie_secure(),
        samesite=_auth_cookie_samesite(),
        max_age=7 * 24 * 60 * 60,
        path="/",
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return session_token, _strip_user(user) or {}


async def registrar_log(user_id: str, acao: str, entidade: str, entidade_id: str, detalhes: dict = None):
    """Registra uma ação no log de atividades"""
    log_doc = {
        "log_id": f"log_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "acao": acao,  # criar, editar, excluir, pagar
        "entidade": entidade,  # guia, empresa
        "entidade_id": entidade_id,
        "detalhes": detalhes or {},
        "created_at": datetime.now(timezone.utc),
    }
    await db.action_logs.insert_one(log_doc)


# ============ APIBRASIL WHATSAPP (https://apibrasil.com.br) ============
def _apibrasil_gateway() -> str:
    base = os.getenv("APIBRASIL_GATEWAY_URL", "https://gateway.apibrasil.io").strip().rstrip("/")
    while base.lower().endswith("/api/v2"):
        base = base[: -len("/api/v2")].rstrip("/")
    return base or "https://gateway.apibrasil.io"


def _apibrasil_headers() -> Optional[dict]:
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


def _whatsapp_session_for_user(user_id: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", user_id) or "contador"
    return f"GuiaControl_{safe}"


def _extrair_qrcode_base64(payload: Any) -> Optional[str]:
    """Extrai imagem/base64 do QR retornado pela APIBrasil (formatos variam)."""
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


def _normalizar_qrcode_data_uri(qr: str) -> str:
    raw = qr.strip()
    if raw.startswith("data:image"):
        return raw
    return f"data:image/png;base64,{raw}"


def _apibrasil_start_session(session: str) -> dict:
    headers = _apibrasil_headers()
    if not headers:
        return {
            "sucesso": False,
            "erro": "APIBrasil nao configurada (APIBRASIL_BEARER_TOKEN e APIBRASIL_DEVICE_TOKEN no .env).",
        }
    gateway = _apibrasil_gateway()
    url = f"{gateway}/api/v2/whatsapp/start"
    payload = {
        "session": session,
        "qrcode": True,
        "device_name": f"GuiaControl-{session[-12:]}",
        "auto_close": 120000,
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=120)
        try:
            data = response.json() if response.text else {}
        except ValueError:
            data = {"raw": response.text}
        ok = _apibrasil_resposta_indica_sucesso(response.status_code, data)
        qr = _extrair_qrcode_base64(data)
        conectado = False
        if isinstance(data, dict):
            st = str(data.get("status") or data.get("state") or "").lower()
            msg = str(data.get("message") or "").lower()
            if st in ("connected", "open", "online", "authenticated", "success"):
                conectado = True
            if "connected" in msg or "conectad" in msg:
                conectado = True
        return {
            "sucesso": ok,
            "status_code": response.status_code,
            "session": session,
            "qrcode_data_uri": _normalizar_qrcode_data_uri(qr) if qr else None,
            "conectado": conectado,
            "resposta": data,
            "erro": None if ok else _mensagem_erro_apibrasil(data),
        }
    except Exception as e:
        logger.error(f"APIBrasil start session: {e}")
        return {"sucesso": False, "erro": str(e), "session": session}


def _apibrasil_sessao_conectada(session: str) -> tuple[bool, dict]:
    """Tenta detectar se a sessao do contador ja esta pareada."""
    headers = _apibrasil_headers()
    if not headers:
        return False, {"erro": "nao_configurado"}
    gateway = _apibrasil_gateway()
    candidatos = [
        ("GET", f"{gateway}/api/v2/whatsapp/device", None),
        ("POST", f"{gateway}/api/v2/whatsapp/getConnectionState", {"session": session}),
        ("POST", f"{gateway}/api/v2/whatsapp/status", {"session": session}),
    ]
    ultimo: dict = {}
    for method, url, body in candidatos:
        try:
            if method == "GET":
                resp = requests.get(url, headers=headers, timeout=20)
            else:
                resp = requests.post(url, json=body, headers=headers, timeout=20)
            try:
                data = resp.json() if resp.text else {}
            except ValueError:
                data = {"raw": resp.text}
            ultimo = {"url": url, "status_code": resp.status_code, "data": data}
            if not (200 <= resp.status_code < 300):
                continue
            blob = json.dumps(data, default=str).lower() if isinstance(data, dict) else str(data).lower()
            if session.lower() in blob and any(
                s in blob for s in ("connected", "open", "online", "authenticated", "conectad")
            ):
                return True, ultimo
            if isinstance(data, dict):
                device = data.get("device")
                if isinstance(device, dict):
                    st = str(device.get("status") or "").lower()
                    if st not in ("disconnected", "offline", "closed", "close", "destroyed", "expired", ""):
                        return True, ultimo
                st = str(data.get("status") or data.get("state") or "").lower()
                if st in ("connected", "open", "online", "authenticated"):
                    return True, ultimo
        except Exception as e:
            ultimo = {"url": url, "erro": str(e)}
    return False, ultimo


async def _whatsapp_ctx_usuario(user_id: str) -> dict:
    doc = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "whatsapp_session": 1, "whatsapp_conectado": 1, "whatsapp_updated_at": 1},
    )
    session = (doc or {}).get("whatsapp_session") or _whatsapp_session_for_user(user_id)
    conectado = bool((doc or {}).get("whatsapp_conectado"))
    return {
        "session": session,
        "conectado": conectado,
        "updated_at": (doc or {}).get("whatsapp_updated_at"),
    }


async def _status_whatsapp_contador(user_id: str) -> dict:
    headers_ok = _apibrasil_headers() is not None
    ctx = await _whatsapp_ctx_usuario(user_id)
    base = {
        "provedor": "apibrasil",
        "configurado": headers_ok,
        "session": ctx["session"],
        "conectado": ctx["conectado"],
        "updated_at": ctx.get("updated_at"),
        "pronto_para_disparar": False,
    }
    if not headers_ok:
        base["detalhes"] = "Defina APIBRASIL_BEARER_TOKEN e APIBRASIL_DEVICE_TOKEN no backend/.env."
        return base

    from communication.providers.factory import get_communication_provider

    provider = get_communication_provider()
    live = False
    det: dict = {}
    if hasattr(provider, "check_session_connected"):
        live, det = await provider.check_session_connected(ctx["session"])
    else:
        live, det = _apibrasil_sessao_conectada(ctx["session"])

    if live and not ctx["conectado"]:
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "whatsapp_conectado": True,
                    "whatsapp_session": ctx["session"],
                    "whatsapp_updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        base["conectado"] = True
    elif not live and ctx["conectado"]:
        # Flag local stale — sincroniza para offline
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "whatsapp_conectado": False,
                    "whatsapp_updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        base["conectado"] = False

    base["detalhes"] = det
    base["pronto_para_disparar"] = bool(base["conectado"] and headers_ok)
    if base["conectado"]:
        plat = _status_whatsapp_apibrasil()
        base["plataforma"] = plat
    return base


def _normalizar_numero_whatsapp_br(telefone: str) -> tuple[Optional[str], Optional[str]]:
    """
    Retorna (numero_e164_sem_mais, erro).
    Formato esperado: 55 + DDD (2) + numero (8 ou 9 digitos), ex. 5555999824552.
    """
    digits = re.sub(r"\D", "", telefone or "")
    if not digits:
        return None, "Telefone vazio"
    local = digits[2:] if digits.startswith("55") and len(digits) >= 12 else digits
    if len(local) not in (10, 11):
        return None, (
            "Numero invalido. Use DDD + celular, ex: 55999824552 ou (55) 99982-4552 "
            "(10 ou 11 digitos sem o 55, ou ja com 55 na frente)."
        )
    return f"55{local}", None


def _mensagem_erro_apibrasil(result: Any) -> str:
    if not isinstance(result, dict):
        return "Falha ao enviar (resposta invalida da APIBrasil)."

    raw = json.dumps(result, ensure_ascii=False, default=str).lower()
    if "msgchunks" in raw:
        return (
            "APIBrasil nao conseguiu enviar. Causa mais provavel: o numero "
            "informado nao tem WhatsApp ativo, ou a sessao do dispositivo "
            "esta dessincronizada. Confira o numero (com DDD) e, se persistir, "
            "reconecte o WhatsApp do contador (Notificacoes > QR Code)."
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
    if result.get("error") is True and result.get("errors"):
        return str(result["errors"])
    return "Falha ao enviar. Verifique APIBrasil, dispositivo conectado e numero."


def _apibrasil_resposta_indica_sucesso(status_code: int, data: Any) -> bool:
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


async def enviar_whatsapp(
    telefone: str,
    mensagem: str,
    session: Optional[str] = None,
) -> dict:
    """Envia mensagem WhatsApp via APIBrasil (POST /api/v2/whatsapp/sendText)."""
    headers = _apibrasil_headers()
    if not headers:
        logger.warning("APIBrasil não configurada (APIBRASIL_BEARER_TOKEN / APIBRASIL_DEVICE_TOKEN).")
        return {
            "sucesso": False,
            "erro": "APIBrasil não configurada no servidor (defina APIBRASIL_BEARER_TOKEN e APIBRASIL_DEVICE_TOKEN).",
        }

    if session:
        live, _ = _apibrasil_sessao_conectada(session)
        if not live:
            return {
                "sucesso": False,
                "erro": "WhatsApp do contador nao conectado. Abra Notificacoes e escaneie o QR Code.",
            }

    phone, phone_err = _normalizar_numero_whatsapp_br(telefone)
    if phone_err:
        return {"sucesso": False, "erro": phone_err}

    gateway = _apibrasil_gateway()
    url = f"{gateway}/api/v2/whatsapp/sendText"
    payload: dict = {"number": phone, "text": mensagem, "time_typing": 1}

    # Default: sempre usa a sessão do escritório (QR). Desliga só com APIBRASIL_SEND_SESSION=false.
    send_session = os.getenv("APIBRASIL_SEND_SESSION", "true").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )
    require_session = os.getenv("APIBRASIL_REQUIRE_SESSION", "true").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )
    if session and send_session:
        payload["session"] = session
    elif require_session and not session:
        return {
            "sucesso": False,
            "erro": "WhatsApp do escritorio nao conectado. Abra Notificacoes e escaneie o QR Code.",
        }

    logger.info(f"Enviando WhatsApp (APIBrasil) para {phone}: {mensagem[:50]}...")

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=45)
        try:
            result = response.json() if response.text else {}
        except ValueError:
            result = {"raw": response.text}
        ok = _apibrasil_resposta_indica_sucesso(response.status_code, result)
        logger.info(f"APIBrasil sendText ({response.status_code}): {result}")
        out: dict = {
            "sucesso": ok,
            "status_code": response.status_code,
            "resposta": result,
            "numero_enviado": phone,
        }
        if not ok:
            out["erro"] = _mensagem_erro_apibrasil(result)
        return out
    except Exception as e:
        logger.error(f"Erro ao enviar WhatsApp (APIBrasil): {e}")
        return {"sucesso": False, "erro": str(e)}


def _status_whatsapp_apibrasil() -> dict:
    """Consulta dispositivo WhatsApp no gateway APIBrasil."""
    headers = _apibrasil_headers()
    if not headers:
        return {
            "provedor": "apibrasil",
            "configurado": False,
            "conectado": False,
            "status_code": None,
            "detalhes": "Defina APIBRASIL_BEARER_TOKEN e APIBRASIL_DEVICE_TOKEN no backend/.env e reinicie a API.",
        }
    gateway = _apibrasil_gateway()
    url = f"{gateway}/api/v2/whatsapp/device"
    try:
        response = requests.get(url, headers=headers, timeout=15)
        try:
            data = response.json() if response.text else {}
        except ValueError:
            data = {"raw": response.text}
        conectado = 200 <= response.status_code < 300
        if isinstance(data, dict):
            device = data.get("device")
            if isinstance(device, dict):
                st = (device.get("status") or "").lower()
                if st in (
                    "disconnected",
                    "offline",
                    "closed",
                    "close",
                    "destroyed",
                    "expired",
                ):
                    conectado = False
        return {
            "provedor": "apibrasil",
            "configurado": True,
            "conectado": conectado,
            "status_code": response.status_code,
            "detalhes": data if isinstance(data, dict) else {"text": str(data)},
        }
    except Exception as e:
        return {"provedor": "apibrasil", "conectado": False, "erro": str(e)}


async def enviar_email_simulado(email: str, assunto: str, mensagem: str) -> dict:
    """Envia email simulado (log). Substituir por SendGrid/SES quando disponível."""
    logger.info(f"📧 EMAIL SIMULADO para {email}")
    logger.info(f"   Assunto: {assunto}")
    logger.info(f"   Mensagem: {mensagem}")
    return {"sucesso": True, "simulado": True, "para": email, "assunto": assunto}


async def registrar_notificacao(
    user_id: str,
    empresa_id: str,
    guia_id: str,
    canal: str,
    destinatario: str,
    mensagem: str,
    resultado: dict,
    reminder_kind: Optional[str] = None,
):
    """Registra uma notificação enviada no histórico (reminder_kind evita duplicidade por tipo)."""
    doc = {
        "notificacao_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "empresa_id": empresa_id,
        "guia_id": guia_id,
        "canal": canal,  # whatsapp, email
        "destinatario": destinatario,
        "mensagem": mensagem,
        "sucesso": resultado.get("sucesso", False),
        "detalhes": resultado,
        "created_at": datetime.now(timezone.utc),
    }
    if reminder_kind:
        doc["reminder_kind"] = reminder_kind
    await db.notificacoes.insert_one(doc)
    return doc


def _parse_vencimento_para_date(data_venc: str) -> Optional[date]:
    """Data de vencimento da guia (calendário local), ou None."""
    if not data_venc or not str(data_venc).strip():
        return None
    s = str(data_venc).strip()
    formatos = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]
    for formato in formatos:
        try:
            return datetime.strptime(s, formato).date()
        except ValueError:
            continue
    return None


def _portal_base_url() -> str:
    """Base do portal do cliente. Prioridade:
    1. PUBLIC_CLIENT_BASE_URL (recomendado em produção, ex: https://app.seudominio.com)
    2. WEB_APP_URL (alternativo)
    3. EXPO_PUBLIC_WEB_APP_URL (mesmo arquivo .env do frontend, útil em testes locais)
    """
    for env_name in ("PUBLIC_CLIENT_BASE_URL", "WEB_APP_URL", "EXPO_PUBLIC_WEB_APP_URL"):
        val = (os.getenv(env_name) or "").strip().rstrip("/")
        if val:
            return val
    return ""


async def _link_portal_cliente(empresa_id: str) -> str:
    """URL pública para o cliente ver guias. Vazio só se nem base URL nem portal_token existirem."""
    emp = await db.empresas.find_one({"empresa_id": empresa_id})
    if not emp:
        return ""
    if not emp.get("portal_token"):
        await _ensure_empresa_portal_token(empresa_id)
        emp = await db.empresas.find_one({"empresa_id": empresa_id})
    token = (emp or {}).get("portal_token") or ""
    base = _portal_base_url()
    if base and token:
        return f"{base}/cliente/{token}"
    return ""


def _formatar_data_br(data: Any) -> str:
    """Converte uma data (ISO `YYYY-MM-DD`, `DD/MM/YYYY` ou `DD-MM-YYYY`) para `DD/MM/YYYY`."""
    if not data:
        return ""
    s = str(data).strip()
    if not s:
        return ""
    for formato in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, formato).strftime("%d/%m/%Y")
        except ValueError:
            continue
    return s


async def _ja_enviou_lembrete(guia_id: str, reminder_kind: str) -> bool:
    """Lembretes D-7/D-3/D-0: uma vez por guia por tipo."""
    doc = await db.notificacoes.find_one(
        {"guia_id": guia_id, "reminder_kind": reminder_kind, "sucesso": True},
        {"_id": 1},
    )
    return doc is not None


async def _ja_enviou_pos_vencimento_hoje(guia_id: str, start_day: datetime, end_day: datetime) -> bool:
    """Após o vencimento: no máximo um lembrete por dia de calendário (UTC)."""
    doc = await db.notificacoes.find_one(
        {
            "guia_id": guia_id,
            "reminder_kind": "pos_vencimento",
            "sucesso": True,
            "created_at": {"$gte": start_day, "$lt": end_day},
        },
        {"_id": 1},
    )
    return doc is not None


def _formatar_valor_br(valor: float) -> str:
    return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


async def _emit_nova_guia_whatsapp(
    *,
    user_id: str,
    empresa: dict,
    guia: dict,
    reminder_kind: str = "nova_guia",
) -> bool:
    """Agenda WhatsApp de nova guia via CommunicationCenter. Retorna True se enfileirou."""
    whatsapp = empresa.get("whatsapp") or empresa.get("telefone")
    if not whatsapp or not empresa.get("notificacoes_whatsapp", True):
        return False

    empresa_id = empresa.get("empresa_id") or guia.get("empresa_id") or ""
    link = await _link_portal_cliente(empresa_id)
    valor_fmt = _formatar_valor_br(float(guia.get("valor") or 0))
    venc_raw = guia.get("data_vencimento")
    venc_fmt = _formatar_data_br(venc_raw) or str(venc_raw or "")
    link_block = ""
    if link:
        link_block = (
            f"\n\n*Seu link (abrir no celular):* {link}\n"
            "Nele você vê a guia, paga (PIX ou linha digitável) e pode *marcar como paga* "
            "ou *anexar comprovante* sem depender do escritório."
        )
    center = get_center()
    await center.emit_guide_reminder(
        accountant_id=user_id,
        empresa_id=empresa_id,
        guia_id=guia["guia_id"],
        event_type=CommunicationEventType.GUIDE_CREATED,
        reminder_kind=reminder_kind,
        payload={
            "phone": whatsapp,
            "tipo": guia.get("tipo"),
            "competencia": guia.get("competencia") or guia.get("tipo"),
            "valor_fmt": valor_fmt,
            "vencimento_fmt": venc_fmt,
            "link": link,
            "link_block": link_block,
        },
    )
    return True


async def verificar_e_notificar_guias(user_id: Optional[str] = None):
    """
    Agenda lembretes via CommunicationCenter (eventos → fila → worker).
    - D-7, D-3, D-0: um evento por guia por marco (dedupe).
    - Apos vencimento: no maximo 1 evento por dia (pos_vencimento).
    Atualiza status para vencida quando a data passou.
    Nao envia WhatsApp diretamente — apenas emite eventos.
    """
    agora = datetime.now(timezone.utc)
    tz_br = ZoneInfo("America/Sao_Paulo")
    agora_br = datetime.now(tz_br)
    hoje_date = agora_br.date()

    resultados = {
        "lembre_d7": 0,
        "lembre_d3": 0,
        "lembre_d0": 0,
        "pos_vencimento": 0,
        "status_atualizados_vencida": 0,
        "eventos_enfileirados": 0,
        "notificacoes_enviadas": 0,  # compat UI — agora significa "agendadas"
        "erros": 0,
        "ignoradas_sem_contato": 0,
    }

    event_map = {
        "lembre_d7": CommunicationEventType.GUIDE_DUE_IN_7_DAYS,
        "lembre_d3": CommunicationEventType.GUIDE_DUE_IN_3_DAYS,
        "lembre_d0": CommunicationEventType.GUIDE_DUE_TODAY,
        "pos_vencimento": CommunicationEventType.GUIDE_OVERDUE,
    }

    query_base: dict = {"status": {"$ne": "paga"}}
    if user_id:
        query_base["user_id"] = user_id

    guias = await db.guias.find(query_base).to_list(length=5000)
    center = get_center()

    for guia in guias:
        data_venc_raw = guia.get("data_vencimento", "")
        venc_date = _parse_vencimento_para_date(str(data_venc_raw))
        if not venc_date:
            continue
        empresa_id = guia.get("empresa_id", "")
        g_user_id = guia.get("user_id", "")

        days_until = (venc_date - hoje_date).days

        if days_until < 0 and guia.get("status") != "vencida":
            await db.guias.update_one(
                {"guia_id": guia["guia_id"]},
                {"$set": {"status": "vencida", "updated_at": agora}},
            )
            resultados["status_atualizados_vencida"] += 1
            guia["status"] = "vencida"

        empresa = await db.empresas.find_one({"empresa_id": empresa_id})
        if not empresa or empresa.get("notificacoes_ativas") is False:
            continue

        reminder_kind: Optional[str] = None
        if days_until == 7:
            reminder_kind = "lembre_d7"
        elif days_until == 3:
            reminder_kind = "lembre_d3"
        elif days_until == 0:
            reminder_kind = "lembre_d0"
        elif days_until < 0:
            reminder_kind = "pos_vencimento"
        else:
            continue

        whatsapp_ativo = empresa.get("notificacoes_whatsapp", True)
        whatsapp = empresa.get("whatsapp") or empresa.get("telefone")
        email_ativo = empresa.get("notificacoes_email", True)
        email = empresa.get("email")

        if not whatsapp and not email:
            resultados["ignoradas_sem_contato"] += 1
            continue

        valor_fmt = _formatar_valor_br(float(guia.get("valor") or 0))
        tipo = guia.get("tipo", "Guia")
        empresa_nome = empresa.get("nome_fantasia") or empresa.get("razao_social", "")
        venc_fmt = _formatar_data_br(data_venc_raw) or str(data_venc_raw)
        link = await _link_portal_cliente(empresa_id)
        link_block = ""
        if link:
            link_block = (
                f"\n\n*Seu link (abrir no celular):* {link}\n"
                "Nele você vê a guia, paga (PIX ou linha digitável) e pode *marcar como paga* ou *anexar comprovante* "
                "sem depender do escritório para isso."
            )

        if whatsapp and whatsapp_ativo:
            try:
                evt = await center.emit_guide_reminder(
                    accountant_id=g_user_id,
                    empresa_id=empresa_id,
                    guia_id=guia["guia_id"],
                    event_type=event_map[reminder_kind],
                    reminder_kind=reminder_kind,
                    payload={
                        "phone": whatsapp,
                        "tipo": tipo,
                        "competencia": tipo,
                        "valor_fmt": valor_fmt,
                        "vencimento_fmt": venc_fmt,
                        "nome": empresa_nome,
                        "link": link,
                        "link_block": link_block,
                    },
                )
                if not evt.get("deduplicated"):
                    resultados[reminder_kind] += 1
                    resultados["eventos_enfileirados"] += 1
                    resultados["notificacoes_enviadas"] += 1
            except Exception as e:
                logger.error("Falha ao enfileirar lembrete %s: %s", guia.get("guia_id"), e)
                resultados["erros"] += 1

        if email and email_ativo:
            titulo = f"GuiaControl — {reminder_kind}"
            assunto = f"{titulo} — {tipo} {valor_fmt}"
            mensagem = f"{tipo} {empresa_nome} {valor_fmt} {venc_fmt}{link_block}"
            resultado_email = await enviar_email_simulado(email, assunto, mensagem)
            await registrar_notificacao(
                g_user_id,
                empresa_id,
                guia["guia_id"],
                "email",
                email,
                mensagem,
                resultado_email,
                reminder_kind=reminder_kind,
            )

    logger.info(f"Job de notificações (CommunicationCenter): {resultados}")
    return resultados


def calcular_status_guia(data_vencimento: str, status_atual: str) -> str:
    """Calcula o status da guia baseado na data de vencimento"""
    if status_atual == "paga":
        return "paga"
    
    hoje = datetime.now().date()
    
    # Tentar parsear a data em diferentes formatos
    vencimento = None
    formatos = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]
    
    for formato in formatos:
        try:
            vencimento = datetime.strptime(data_vencimento, formato).date()
            break
        except ValueError:
            continue
    
    if vencimento is None:
        # Se não conseguiu parsear, assumir formato padrão
        raise ValueError(f"Formato de data inválido: {data_vencimento}. Use YYYY-MM-DD ou DD/MM/YYYY")
    
    if vencimento < hoje:
        return "vencida"
    else:
        return "a_vencer"

async def get_current_user(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
) -> dict:
    """Autentica o usuário pelo cookie ou header Authorization"""
    token = session_token
    
    # Fallback para Authorization header
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    # Buscar sessão no banco
    session_doc = await db.user_sessions.find_one(
        {"session_token": token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    
    # Verificar expiração
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sessão expirada")
    
    # Buscar usuário
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0, "password_hash": 0},
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    return _strip_user(user_doc) or user_doc


def _new_portal_token() -> str:
    return secrets.token_urlsafe(32)


async def _ensure_empresa_portal_token(empresa_id: str) -> str:
    """Garante que a empresa tenha portal_token (link do cliente). Retorna o token."""
    doc = await db.empresas.find_one({"empresa_id": empresa_id}, {"portal_token": 1})
    if doc and doc.get("portal_token"):
        return doc["portal_token"]
    tok = _new_portal_token()
    await db.empresas.update_one(
        {"empresa_id": empresa_id},
        {"$set": {"portal_token": tok, "updated_at": datetime.now(timezone.utc)}},
    )
    return tok


def _sanitize_guia_for_public(g: dict) -> dict:
    """Remove dados sensíveis / pesados da guia na visão do cliente (link mágico)."""
    return {
        "guia_id": g.get("guia_id"),
        "tipo": g.get("tipo"),
        "descricao": g.get("descricao"),
        "valor": g.get("valor"),
        "data_vencimento": g.get("data_vencimento"),
        "status": g.get("status"),
        "data_pagamento": g.get("data_pagamento"),
        "codigo_barras": g.get("codigo_barras"),
        "qr_code_pix": g.get("qr_code_pix"),
        "observacoes": g.get("observacoes"),
    }


# ============ AUTH ROUTES ============

@api_router.post("/auth/session")
async def create_session(
    response: Response,
    session_id: str = Header(..., alias="X-Session-ID")
):
    """Troca session_id por session_token permanente"""
    
    # Chamar API do Emergent Auth
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Session ID inválido")
        
        user_data = auth_response.json()
    
    email_norm = (user_data.get("email") or "").strip().lower()
    if not email_norm:
        raise HTTPException(status_code=400, detail="Email inválido na sessão")

    # Criar ou atualizar usuário
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing_user = await db.users.find_one({"email": email_norm}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": user_data["name"],
                "picture": user_data.get("picture"),
                "email": email_norm,
            }}
        )
    else:
        user_doc = {
            "user_id": user_id,
            "email": email_norm,
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user_doc)
    
    session_token, user = await _commit_session(user_id, response)
    return {"user": user, "session_token": session_token}


@api_router.post("/auth/register")
async def auth_register(response: Response, body: AuthRegisterBody):
    """Cadastro local com e-mail e senha (sem Google / Emergent)."""
    email_norm = body.email.strip().lower()
    if await db.users.find_one({"email": email_norm}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado")

    password_hash = bcrypt.hashpw(
        body.password.encode("utf-8"), bcrypt.gensalt(rounds=12)
    ).decode("ascii")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email_norm,
        "name": body.name.strip(),
        "picture": None,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    session_token, user = await _commit_session(user_id, response)
    return {"user": user, "session_token": session_token}


@api_router.post("/auth/login")
async def auth_login(response: Response, body: AuthLoginBody):
    """Login local com e-mail e senha."""
    email_norm = body.email.strip().lower()
    user = await db.users.find_one({"email": email_norm})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    try:
        ok = bcrypt.checkpw(
            body.password.encode("utf-8"),
            user["password_hash"].encode("utf-8"),
        )
    except ValueError:
        ok = False
    if not ok:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

    user_id = user["user_id"]
    session_token, safe_user = await _commit_session(user_id, response)
    return {"user": safe_user, "session_token": session_token}


@api_router.get("/auth/me")
async def get_me(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Retorna dados do usuário autenticado"""
    user = await get_current_user(session_token, authorization)
    return user

@api_router.post("/auth/logout")
async def logout(
    response: Response,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Faz logout do usuário (cookie HttpOnly ou Bearer no app)."""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logout realizado com sucesso"}


# ============ CNPJ ROUTES ============

@api_router.get("/cnpj/{cnpj}")
async def buscar_cnpj(cnpj: str):
    """Busca dados da empresa por CNPJ usando API CNPJá"""
    
    # Remover pontuação do CNPJ
    cnpj_limpo = cnpj.replace(".", "").replace("/", "").replace("-", "")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://open.cnpja.com/office/{cnpj_limpo}",
                timeout=10.0
            )
            
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="CNPJ não encontrado")
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=500, 
                    detail="Erro ao consultar CNPJ"
                )
            
            data = response.json()
            
            # Formatar resposta
            return {
                "cnpj": data.get("taxId"),
                "razao_social": data.get("company", {}).get("name", ""),
                "nome_fantasia": data.get("alias"),
                "dados_completos": data
            }
            
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504, 
            detail="Timeout ao consultar CNPJ"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao buscar CNPJ: {str(e)}"
        )


# ============ OCR ROUTES ============

class OCRRequest(BaseModel):
    image_base64: str

class OCRResponse(BaseModel):
    texto_completo: str
    valor: Optional[float] = None
    data_vencimento: Optional[str] = None
    codigo_barras: Optional[str] = None
    qr_code_pix: Optional[str] = None
    competencia: Optional[str] = None
    tipo_documento: Optional[str] = None
    descricao_sugerida: Optional[str] = None
    cnpj: Optional[str] = None


class LoteAnalisarItem(BaseModel):
    temp_id: str
    filename: str
    file_hash: Optional[str] = None
    texto_completo: Optional[str] = ""
    valor: Optional[float] = None
    data_vencimento: Optional[str] = None
    codigo_barras: Optional[str] = None
    qr_code_pix: Optional[str] = None
    competencia: Optional[str] = None
    tipo_documento: Optional[str] = None
    descricao_sugerida: Optional[str] = None
    cnpj: Optional[str] = None
    empresa_id: Optional[str] = None


class LoteAnalisarRequest(BaseModel):
    itens: List[LoteAnalisarItem]


class GuiaLoteItem(BaseModel):
    temp_id: str
    empresa_id: str
    tipo: str
    descricao: str
    valor: float
    data_vencimento: str
    codigo_barras: Optional[str] = None
    qr_code_pix: Optional[str] = None
    observacoes: Optional[str] = None
    competencia: Optional[str] = None
    arquivo_guia: Optional[str] = None
    nome_arquivo_guia: Optional[str] = None
    tipo_arquivo_guia: Optional[str] = None
    ignorar_duplicidade: bool = False


class GuiaLoteConfirmRequest(BaseModel):
    itens: List[GuiaLoteItem]
    enviar_notificacoes: bool = False


def decodificar_codigos_imagem(base64_data: str, content_type: str = 'image/jpeg') -> dict:
    """
    Decodifica QR Codes e códigos de barras diretamente da imagem usando pyzbar + zxing-cpp.
    Funciona com imagens (JPEG, PNG) e PDFs (converte páginas para imagem com PyMuPDF).
    
    Aplica múltiplas estratégias de pré-processamento para maximizar detecção:
    1. Imagem original
    2. Zoom 2x-4x com interpolação bicúbica
    3. Escala de cinza + threshold adaptativo
    4. Recorte automático de regiões de QR Code
    5. CLAHE (equalização de histograma adaptativa)
    
    Retorna: {"qr_codes": [...], "barcodes": [...]}
    """
    resultado = {"qr_codes": [], "barcodes": []}
    
    try:
        image_bytes = base64.b64decode(base64_data)
        
        imagens_cv = []  # Lista de imagens OpenCV (numpy arrays)
        
        if not CV2_AVAILABLE:
            logger.warning("OpenCV não disponível para decodificação visual")
            return resultado
        
        if content_type == 'application/pdf':
            logger.info("Decodificando QR/Barcode de PDF com PyMuPDF...")
            try:
                pdf_doc = fitz.open(stream=image_bytes, filetype="pdf")
                for page_num in range(min(len(pdf_doc), 5)):
                    page = pdf_doc[page_num]
                    # Renderizar em 300 DPI para máxima qualidade
                    mat = fitz.Matrix(300/72, 300/72)
                    pix = page.get_pixmap(matrix=mat)
                    img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
                    if pix.n == 4:  # RGBA -> BGR
                        img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
                    elif pix.n == 3:  # RGB -> BGR
                        img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                    else:
                        img_cv = img_array
                    imagens_cv.append(img_cv)
                    logger.info(f"PDF página {page_num + 1}: {img_cv.shape[1]}x{img_cv.shape[0]} px")
                pdf_doc.close()
            except Exception as e:
                logger.error(f"Erro ao converter PDF: {e}")
        else:
            logger.info("Decodificando QR/Barcode de imagem...")
            try:
                img_array = np.frombuffer(image_bytes, dtype=np.uint8)
                img_cv = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                if img_cv is not None:
                    imagens_cv.append(img_cv)
                    logger.info(f"Imagem: {img_cv.shape[1]}x{img_cv.shape[0]} px")
                else:
                    logger.error("OpenCV não conseguiu decodificar a imagem")
            except Exception as e:
                logger.error(f"Erro ao abrir imagem: {e}")
        
        qr_set = set()  # Evitar duplicatas
        bc_set = set()
        
        for idx, img_cv in enumerate(imagens_cv):
            h, w = img_cv.shape[:2]
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            
            # Lista de imagens para tentar (original + pré-processadas)
            candidatas = []
            
            # 1. Original
            candidatas.append(("original", gray))
            
            # 2. CLAHE (equalização adaptativa de contraste)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            candidatas.append(("clahe", enhanced))
            
            # 3. Threshold de Otsu
            _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            candidatas.append(("otsu", otsu))
            
            # 4. Zoom 2x
            gray_2x = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
            candidatas.append(("zoom2x", gray_2x))
            
            # 5. Zoom 3x
            gray_3x = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
            candidatas.append(("zoom3x", gray_3x))
            
            # 6. Recorte do quadrante inferior (QR codes geralmente ficam na parte de baixo)
            bottom_half = gray[h//2:, :]
            bottom_3x = cv2.resize(bottom_half, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
            candidatas.append(("bottom_3x", bottom_3x))
            
            # 7. Recorte inferior direito (posição mais comum do QR Code PIX)
            qr_region = gray[int(h*0.6):, int(w*0.4):]
            qr_4x = cv2.resize(qr_region, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
            candidatas.append(("qr_region_4x", qr_4x))
            
            # 8. Recorte inferior direito + CLAHE + threshold adaptativo
            qr_clahe = clahe.apply(qr_4x)
            qr_adaptive = cv2.adaptiveThreshold(qr_clahe, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 5)
            candidatas.append(("qr_adaptive", qr_adaptive))
            
            for nome, img_proc in candidatas:
                # Tentar com pyzbar
                pil_img = Image.fromarray(img_proc)
                try:
                    codigos_pyzbar = pyzbar_decode(pil_img)
                    for c in codigos_pyzbar:
                        dados = c.data.decode('utf-8', errors='replace')
                        if c.type == 'QRCODE' and dados not in qr_set:
                            qr_set.add(dados)
                            resultado["qr_codes"].append(dados)
                            logger.info(f"✅ [pyzbar/{nome}] QR Code: {dados[:80]}...")
                        elif c.type != 'QRCODE':
                            key = f"{c.type}:{dados}"
                            if key not in bc_set:
                                bc_set.add(key)
                                resultado["barcodes"].append({"tipo": c.type, "dados": dados})
                                logger.info(f"✅ [pyzbar/{nome}] Barcode {c.type}: {dados[:60]}...")
                except Exception:
                    pass
                
                # Tentar com zxing-cpp
                try:
                    codigos_zxing = zxingcpp.read_barcodes(pil_img)
                    for c in codigos_zxing:
                        fmt = str(c.format)
                        dados = c.text
                        if 'QRCode' in fmt and dados not in qr_set:
                            qr_set.add(dados)
                            resultado["qr_codes"].append(dados)
                            logger.info(f"✅ [zxing/{nome}] QR Code: {dados[:80]}...")
                        elif 'QRCode' not in fmt:
                            key = f"{fmt}:{dados}"
                            if key not in bc_set:
                                bc_set.add(key)
                                resultado["barcodes"].append({"tipo": fmt, "dados": dados})
                                logger.info(f"✅ [zxing/{nome}] Barcode {fmt}: {dados[:60]}...")
                except Exception:
                    pass
                
                # Se já encontrou QR e barcode, parar de tentar
                if resultado["qr_codes"] and resultado["barcodes"]:
                    break
            
            # Também tentar o detector de QR nativo do OpenCV
            try:
                qr_detector = cv2.QRCodeDetector()
                for nome, img_proc in candidatas:
                    data, bbox, _ = qr_detector.detectAndDecode(img_proc)
                    if data and data not in qr_set:
                        qr_set.add(data)
                        resultado["qr_codes"].append(data)
                        logger.info(f"✅ [opencv/{nome}] QR Code: {data[:80]}...")
                        break
            except Exception:
                pass
        
        total = len(resultado["qr_codes"]) + len(resultado["barcodes"])
        logger.info(f"Total de códigos encontrados: {total} ({len(resultado['qr_codes'])} QR, {len(resultado['barcodes'])} barcode)")
        
    except ImportError as e:
        logger.warning(f"Bibliotecas de decodificação visual não disponíveis: {e}")
    except Exception as e:
        logger.error(f"Erro geral na decodificação de códigos: {e}")
    
    return resultado


# === Funções de extração agora vivem em ocr_lote.py ===
# (corrigir_ocr_digitos, validar_barcode_candidato, extrair_codigo_barras,
#  extrair_qr_code_pix, extrair_dados_guia)


@api_router.post("/ocr/processar", response_model=OCRResponse)
async def processar_ocr(
    ocr_request: OCRRequest,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Processa imagem com OCR e extrai dados da guia"""
    
    # Autenticar usuário (verifica se está logado)
    await get_current_user(session_token, authorization)
    
    try:
        # Extrair base64 puro (remover prefixo data:image/... ou data:application/pdf;...)
        base64_data = ocr_request.image_base64
        content_type = 'image/jpeg'  # default
        if ',' in base64_data:
            header_part = base64_data.split(',')[0]
            base64_data = base64_data.split(',')[1]
            # Detectar tipo de conteúdo
            if 'application/pdf' in header_part:
                content_type = 'application/pdf'
            elif 'image/png' in header_part:
                content_type = 'image/png'
            elif 'image/jpeg' in header_part or 'image/jpg' in header_part:
                content_type = 'image/jpeg'
        
        is_pdf = content_type == 'application/pdf'
        logger.info(f"OCR - Tipo de conteúdo: {content_type}, PDF: {is_pdf}")
        
        # Chamar API OCR.space (free tier)
        url = "https://api.ocr.space/parse/image"
        
        # API key do OCR.space (free tier)
        ocr_api_key = os.environ.get('OCR_API_KEY', 'K85834988788957')
        
        payload = {
            'base64Image': f'data:{content_type};base64,{base64_data}',
            'language': 'por',  # Português
            'isOverlayRequired': False,
            'detectOrientation': True,
            'scale': True,
            'OCREngine': 2,  # Engine 2 é melhor para documentos
        }
        
        # Para PDFs, adicionar parâmetro específico
        if is_pdf:
            payload['filetype'] = 'PDF'
            payload['isCreateSearchablePdf'] = False
        
        headers = {
            'apikey': ocr_api_key,
        }
        
        logger.info("Chamando API OCR.space...")
        response = requests.post(url, data=payload, headers=headers, timeout=60)
        
        logger.info(f"OCR Response status: {response.status_code}")
        
        # Verificar se a resposta é válida
        try:
            result = response.json()
        except Exception:
            logger.error(f"OCR retornou resposta não-JSON: {response.text[:500]}")
            raise HTTPException(
                status_code=500,
                detail="Resposta inválida do serviço OCR"
            )
        
        logger.info(f"OCR Result keys: {list(result.keys()) if isinstance(result, dict) else type(result)}")
        
        # Se result é uma lista ou string, tratar
        if isinstance(result, str):
            logger.error(f"OCR retornou string: {result[:200]}")
            raise HTTPException(
                status_code=500,
                detail="Serviço OCR retornou formato inesperado"
            )
        
        if isinstance(result, list):
            result = result[0] if result else {}
        
        if result.get('IsErroredOnProcessing'):
            error_msg = result.get('ErrorMessage', ['Erro desconhecido'])
            if isinstance(error_msg, list):
                error_msg = '; '.join(error_msg)
            logger.error(f"OCR erro: {error_msg}")
            raise HTTPException(
                status_code=500,
                detail=f"Erro no OCR: {error_msg}"
            )
        
        # Extrair texto
        texto_completo = ""
        parsed_results = result.get('ParsedResults', [])
        if parsed_results and len(parsed_results) > 0:
            texto_completo = parsed_results[0].get('ParsedText', '')
        
        logger.info(f"OCR texto extraído ({len(texto_completo)} chars)")
        
        # Extrair dados estruturados do texto OCR
        dados = extrair_dados_guia(texto_completo)
        
        # === DECODIFICAÇÃO VISUAL DE QR CODE E CÓDIGO DE BARRAS ===
        # PDF em 300 DPI + múltiplas variações OpenCV estoura RAM no Render Free (502).
        # Guias em PDF já trazem código de barras no texto do OCR.space — pulamos visual em PDF.
        run_visual = content_type != "application/pdf" or os.environ.get(
            "OCR_ENABLE_VISUAL_PDF", ""
        ).lower() in ("1", "true", "yes")
        try:
            if not run_visual:
                logger.info("OCR visual ignorado para PDF (economia de memória no servidor)")
                codigos_visuais = {"qr_codes": [], "barcodes": []}
            else:
                codigos_visuais = decodificar_codigos_imagem(base64_data, content_type)
            
            # Se encontrou QR Code e ainda não temos PIX do texto OCR
            if codigos_visuais["qr_codes"] and not dados.get("qr_code_pix"):
                # Pegar o primeiro QR Code que parece ser PIX (começa com 0002)
                for qr in codigos_visuais["qr_codes"]:
                    if qr.startswith("0002"):
                        dados["qr_code_pix"] = qr
                        logger.info(f"✅ QR Code PIX detectado por pyzbar: {qr[:80]}...")
                        break
                # Se nenhum começou com 0002, pegar o primeiro de qualquer forma
                if not dados.get("qr_code_pix") and codigos_visuais["qr_codes"]:
                    dados["qr_code_pix"] = codigos_visuais["qr_codes"][0]
                    logger.info(f"✅ QR Code detectado por pyzbar (genérico): {codigos_visuais['qr_codes'][0][:80]}...")
            
            # Se encontrou barcode visual e ainda não temos do texto OCR
            if codigos_visuais["barcodes"] and not dados.get("codigo_barras"):
                for bc in codigos_visuais["barcodes"]:
                    bc_dados = bc["dados"]
                    # Verificar se é um código de barras de guia (44-48 dígitos)
                    if bc_dados.isdigit() and 44 <= len(bc_dados) <= 60:
                        dados["codigo_barras"] = bc_dados[:48] if len(bc_dados) >= 48 else bc_dados
                        logger.info(f"✅ Código de barras detectado por pyzbar ({bc['tipo']}): {dados['codigo_barras']}")
                        break
        except Exception as e:
            logger.warning(f"Erro na decodificação visual (não crítico): {e}")
        
        return OCRResponse(
            texto_completo=texto_completo,
            valor=dados['valor'],
            data_vencimento=dados['data_vencimento'],
            codigo_barras=dados['codigo_barras'],
            qr_code_pix=dados.get('qr_code_pix'),
            competencia=dados.get('competencia'),
            tipo_documento=dados.get('tipo_documento'),
            descricao_sugerida=dados.get('descricao_sugerida'),
            cnpj=dados.get('cnpj'),
        )
        
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Timeout ao processar OCR"
        )
    except Exception as e:
        logger.error(f"Erro ao processar OCR: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar imagem: {str(e)}"
        )


@api_router.post("/ocr/lote/analisar")
async def ocr_lote_analisar(
    body: LoteAnalisarRequest,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Match empresa, duplicidade e agrupamento após OCR de cada arquivo."""
    user = await get_current_user(session_token, authorization)
    if not body.itens:
        raise HTTPException(status_code=400, detail="Nenhum item no lote")

    empresas = await db.empresas.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(5000)
    guias_db = await db.guias.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(10000)
    itens_raw = [i.dict() for i in body.itens]
    return analisar_itens_lote(itens_raw, empresas, guias_db)


@api_router.post("/ocr/lote/hash")
async def ocr_lote_hash(
    ocr_request: OCRRequest,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Retorna hash do arquivo para detecção de duplicata no cliente."""
    await get_current_user(session_token, authorization)
    return {"file_hash": hash_arquivo_base64(ocr_request.image_base64)}


@api_router.post("/ocr/debug")
async def debug_ocr(ocr_request: OCRRequest):
    """
    Endpoint de debug OCR - sem autenticação.
    Retorna o texto bruto do OCR e todos os dados extraídos.
    Útil para testar e ajustar os padrões de extração.
    """
    try:
        base64_data = ocr_request.image_base64
        content_type = 'image/jpeg'
        if ',' in base64_data:
            header_part = base64_data.split(',')[0]
            base64_data = base64_data.split(',')[1]
            if 'application/pdf' in header_part:
                content_type = 'application/pdf'
            elif 'image/png' in header_part:
                content_type = 'image/png'
        
        is_pdf = content_type == 'application/pdf'
        
        url = "https://api.ocr.space/parse/image"
        ocr_api_key = os.environ.get('OCR_API_KEY', 'K85834988788957')
        
        payload = {
            'base64Image': f'data:{content_type};base64,{base64_data}',
            'language': 'por',
            'isOverlayRequired': False,
            'detectOrientation': True,
            'scale': True,
            'OCREngine': 2,
        }
        
        if is_pdf:
            payload['filetype'] = 'PDF'
            payload['isCreateSearchablePdf'] = False
        
        headers = {'apikey': ocr_api_key}
        response = requests.post(url, data=payload, headers=headers, timeout=60)
        result = response.json()
        
        texto_completo = ""
        parsed_results = result.get('ParsedResults', [])
        if parsed_results:
            texto_completo = parsed_results[0].get('ParsedText', '')
        
        dados = extrair_dados_guia(texto_completo)
        
        return {
            "texto_bruto": texto_completo,
            "texto_linhas": texto_completo.split('\n'),
            "dados_extraidos": dados,
            "ocr_engine": 2,
            "content_type": content_type,
        }
    except Exception as e:
        return {"erro": str(e)}


@api_router.post("/ocr/testar-extracao")
async def testar_extracao_ocr(body: dict):
    """
    Testa a extração de dados a partir de um texto já extraído pelo OCR.
    Útil para ajustar regex sem precisar chamar a API OCR novamente.
    Body: {"texto": "...texto do OCR..."}
    """
    texto = body.get("texto", "")
    if not texto:
        raise HTTPException(status_code=400, detail="Campo 'texto' é obrigatório")
    
    dados = extrair_dados_guia(texto)
    return {
        "dados_extraidos": dados,
        "texto_recebido_chars": len(texto),
    }


# ============ EMPRESAS ROUTES ============

@api_router.post("/empresas")
async def criar_empresa(
    empresa_data: EmpresaCreate,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Cria uma nova empresa para o usuário"""
    user = await get_current_user(session_token, authorization)
    
    # Buscar dados do CNPJ
    cnpj_limpo = empresa_data.cnpj.replace(".", "").replace("/", "").replace("-", "")
    
    # Verificar se empresa já existe para este usuário
    existing = await db.empresas.find_one({
        "user_id": user["user_id"],
        "cnpj": cnpj_limpo
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Empresa já cadastrada"
        )
    
    # Buscar dados na API
    dados_cnpj = await buscar_cnpj(cnpj_limpo)
    
    # Criar empresa
    empresa_id = f"empresa_{uuid.uuid4().hex[:12]}"
    empresa_doc = {
        "empresa_id": empresa_id,
        "user_id": user["user_id"],
        "cnpj": cnpj_limpo,
        "razao_social": dados_cnpj["razao_social"],
        "nome_fantasia": dados_cnpj.get("nome_fantasia"),
        "dados_completos": dados_cnpj.get("dados_completos"),
        "portal_token": _new_portal_token(),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.empresas.insert_one(empresa_doc)
    
    # Retornar sem _id
    empresa = await db.empresas.find_one(
        {"empresa_id": empresa_id},
        {"_id": 0}
    )
    return empresa

@api_router.get("/empresas")
async def listar_empresas(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Lista todas as empresas do usuário"""
    user = await get_current_user(session_token, authorization)
    
    empresas = await db.empresas.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(1000)

    for e in empresas:
        if not e.get("portal_token"):
            e["portal_token"] = await _ensure_empresa_portal_token(e["empresa_id"])
    
    return empresas

@api_router.delete("/empresas/{empresa_id}")
async def deletar_empresa(
    empresa_id: str,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Deleta uma empresa"""
    user = await get_current_user(session_token, authorization)
    
    empresa = await db.empresas.find_one({
        "empresa_id": empresa_id,
        "user_id": user["user_id"]
    })
    
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    result = await db.empresas.delete_one({
        "empresa_id": empresa_id,
        "user_id": user["user_id"]
    })
    
    # Deletar também todas as guias dessa empresa
    deleted_guias = await db.guias.delete_many({
        "empresa_id": empresa_id,
        "user_id": user["user_id"]
    })
    
    await registrar_log(user["user_id"], "excluir", "empresa", empresa_id, {
        "razao_social": empresa.get("razao_social"),
        "guias_removidas": deleted_guias.deleted_count,
    })
    
    return {"message": "Empresa deletada com sucesso", "guias_removidas": deleted_guias.deleted_count}


@api_router.patch("/empresas/{empresa_id}")
async def editar_empresa(
    empresa_id: str,
    empresa_data: EmpresaUpdate,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Edita uma empresa"""
    user = await get_current_user(session_token, authorization)
    
    empresa = await db.empresas.find_one({
        "empresa_id": empresa_id,
        "user_id": user["user_id"]
    })
    
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    update_data = {k: v for k, v in empresa_data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.empresas.update_one(
        {"empresa_id": empresa_id},
        {"$set": update_data}
    )
    
    await registrar_log(user["user_id"], "editar", "empresa", empresa_id, {
        "campos_alterados": list(update_data.keys()),
    })
    
    empresa_atualizada = await db.empresas.find_one(
        {"empresa_id": empresa_id},
        {"_id": 0}
    )
    return empresa_atualizada


@api_router.get("/empresas/{empresa_id}")
async def obter_empresa(
    empresa_id: str,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Obtém uma empresa específica"""
    user = await get_current_user(session_token, authorization)
    
    empresa = await db.empresas.find_one(
        {"empresa_id": empresa_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    if not empresa.get("portal_token"):
        tok = await _ensure_empresa_portal_token(empresa_id)
        empresa["portal_token"] = tok
    
    return empresa


@api_router.post("/empresas/{empresa_id}/regenerar-portal-token")
async def regenerar_portal_token_empresa(
    empresa_id: str,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Gera um novo link do cliente (invalida o token anterior)."""
    user = await get_current_user(session_token, authorization)
    empresa = await db.empresas.find_one(
        {"empresa_id": empresa_id, "user_id": user["user_id"]},
        {"_id": 0},
    )
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    tok = _new_portal_token()
    await db.empresas.update_one(
        {"empresa_id": empresa_id},
        {"$set": {"portal_token": tok, "updated_at": datetime.now(timezone.utc)}},
    )
    await registrar_log(user["user_id"], "editar", "empresa", empresa_id, {"acao": "regenerar_portal_token"})
    return {"portal_token": tok, "empresa_id": empresa_id}


@api_router.get("/public/cliente/{portal_token}")
async def public_portal_cliente(portal_token: str):
    """
    Portal read-only para o cliente (PME) abrir pelo link mágico, sem login.
    Não expõe user_id, arquivos base64 nem comprovantes.
    """
    if not portal_token or len(portal_token) < 12:
        raise HTTPException(status_code=400, detail="Token inválido")

    empresa = await db.empresas.find_one({"portal_token": portal_token}, {"_id": 0})
    if not empresa:
        raise HTTPException(status_code=404, detail="Link inválido")

    empresa_id = empresa["empresa_id"]
    guias_raw = await db.guias.find({"empresa_id": empresa_id}, {"_id": 0}).sort("data_vencimento", 1).to_list(2000)

    guias_out = []
    for g in guias_raw:
        if g.get("status") != "paga":
            novo_status = calcular_status_guia(g["data_vencimento"], g.get("status", "a_vencer"))
            if novo_status != g.get("status"):
                await db.guias.update_one(
                    {"guia_id": g["guia_id"]},
                    {"$set": {"status": novo_status}},
                )
                g["status"] = novo_status
        guias_out.append(_sanitize_guia_for_public(g))

    return {
        "empresa": {
            "razao_social": empresa.get("razao_social"),
            "nome_fantasia": empresa.get("nome_fantasia"),
            "cnpj": empresa.get("cnpj"),
        },
        "guias": guias_out,
    }


@api_router.post("/public/cliente/{portal_token}/guias/{guia_id}/marcar-paga")
async def public_portal_marcar_guia_paga(
    portal_token: str,
    guia_id: str,
    comprovante_data: ComprovanteUpload = Body(default_factory=ComprovanteUpload),
):
    """
    Cliente informa pagamento pelo link do portal (sem login do contador).
    Valida portal_token + empresa da guia; opcionalmente anexa comprovante em base64 (data URL).
    """
    if not portal_token or len(portal_token) < 12:
        raise HTTPException(status_code=400, detail="Token inválido")

    empresa = await db.empresas.find_one({"portal_token": portal_token}, {"_id": 0, "empresa_id": 1})
    if not empresa:
        raise HTTPException(status_code=404, detail="Link inválido")

    empresa_id = empresa["empresa_id"]
    guia = await db.guias.find_one({"guia_id": guia_id, "empresa_id": empresa_id})
    if not guia:
        raise HTTPException(status_code=404, detail="Guia não encontrada")

    if guia.get("status") == "paga":
        raise HTTPException(status_code=400, detail="Esta guia já está marcada como paga")

    update_data: dict = {
        "status": "paga",
        "data_pagamento": datetime.now().strftime("%Y-%m-%d"),
        "updated_at": datetime.now(timezone.utc),
    }
    if comprovante_data and comprovante_data.comprovante:
        update_data["comprovante"] = comprovante_data.comprovante

    await db.guias.update_one({"guia_id": guia_id}, {"$set": update_data})

    owner_id = guia.get("user_id")
    if owner_id:
        await registrar_log(
            owner_id,
            "pagar",
            "guia",
            guia_id,
            {
                "origem": "portal_cliente",
                "com_comprovante": bool(comprovante_data and comprovante_data.comprovante),
            },
        )

    return {
        "ok": True,
        "message": "Pagamento registrado. Seu contador poderá conferir no sistema.",
    }


# ============ GUIAS ROUTES ============

@api_router.post("/guias")
async def criar_guia(
    guia_data: GuiaCreate,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Cria uma nova guia"""
    user = await get_current_user(session_token, authorization)
    return await _criar_guia_interna(
        user=user,
        guia_data=guia_data,
        emit_created=True,
    )


async def _criar_guia_interna(
    *,
    user: dict,
    guia_data: GuiaCreate,
    emit_created: bool = True,
    reminder_kind: str = "nova_guia",
) -> dict:
    """Persistência compartilhada entre cadastro unitário e lote."""
    logger.info(
        f"Criando guia - dados recebidos: empresa_id={guia_data.empresa_id}, "
        f"tipo={guia_data.tipo}, valor={guia_data.valor}, data_vencimento={guia_data.data_vencimento}"
    )

    empresa = await db.empresas.find_one({
        "empresa_id": guia_data.empresa_id,
        "user_id": user["user_id"],
    })

    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    data_vencimento_normalizada = guia_data.data_vencimento
    formatos = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]
    data_parseada = False
    for formato in formatos:
        try:
            data_obj = datetime.strptime(guia_data.data_vencimento.strip(), formato)
            data_vencimento_normalizada = data_obj.strftime("%Y-%m-%d")
            data_parseada = True
            break
        except ValueError:
            continue

    if not data_parseada:
        logger.error(f"Formato de data inválido: {guia_data.data_vencimento}")
        raise HTTPException(
            status_code=400,
            detail=f"Formato de data inválido: '{guia_data.data_vencimento}'. Use YYYY-MM-DD ou DD/MM/YYYY",
        )

    try:
        status = calcular_status_guia(data_vencimento_normalizada, "a_vencer")
    except ValueError as e:
        logger.error(f"Erro ao calcular status: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    nome_arquivo = None
    tipo_arquivo = None
    if guia_data.arquivo_guia:
        if guia_data.arquivo_guia.startswith("data:application/pdf"):
            tipo_arquivo = "PDF"
            nome_arquivo = f'guia_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        elif guia_data.arquivo_guia.startswith("data:image/jpeg") or guia_data.arquivo_guia.startswith(
            "data:image/jpg"
        ):
            tipo_arquivo = "JPG"
            nome_arquivo = f'guia_{datetime.now().strftime("%Y%m%d_%H%M%S")}.jpg'
        elif guia_data.arquivo_guia.startswith("data:image/png"):
            tipo_arquivo = "PNG"
            nome_arquivo = f'guia_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
        else:
            tipo_arquivo = "DESCONHECIDO"
            nome_arquivo = f'guia_{datetime.now().strftime("%Y%m%d_%H%M%S")}'

    guia_id = f"guia_{uuid.uuid4().hex[:12]}"
    guia_doc = {
        "guia_id": guia_id,
        "user_id": user["user_id"],
        "empresa_id": guia_data.empresa_id,
        "tipo": guia_data.tipo,
        "descricao": guia_data.descricao,
        "valor": guia_data.valor,
        "data_vencimento": data_vencimento_normalizada,
        "status": status,
        "codigo_barras": guia_data.codigo_barras,
        "qr_code_pix": guia_data.qr_code_pix,
        "observacoes": guia_data.observacoes,
        "competencia": guia_data.competencia,
        "data_pagamento": None,
        "comprovante": None,
        "arquivo_guia": guia_data.arquivo_guia,
        "nome_arquivo_guia": nome_arquivo,
        "tipo_arquivo_guia": tipo_arquivo,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    await db.guias.insert_one(guia_doc)

    guia = await db.guias.find_one({"guia_id": guia_id}, {"_id": 0})
    if emit_created and guia:
        try:
            await _emit_nova_guia_whatsapp(
                user_id=user["user_id"],
                empresa=empresa,
                guia=guia,
                reminder_kind=reminder_kind,
            )
        except Exception as ex:
            logger.warning(f"Falha ao agendar WhatsApp de nova guia {guia_id}: {ex}")
    return guia


@api_router.post("/guias/lote")
async def criar_guias_lote(
    body: GuiaLoteConfirmRequest,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Confirma cadastro em massa após revisão do OCR."""
    user = await get_current_user(session_token, authorization)
    if not body.itens:
        raise HTTPException(status_code=400, detail="Nenhuma guia no lote")

    empresas = await db.empresas.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(5000)
    emp_map = {e["empresa_id"]: e for e in empresas}
    guias_db = await db.guias.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(10000)

    criadas: list[dict] = []
    erros: list[dict] = []
    notificacoes_enviadas = 0

    wctx = await _whatsapp_ctx_usuario(user["user_id"])
    wa_session = wctx["session"] if wctx.get("conectado") else None
    emit_lote = bool(body.enviar_notificacoes and wa_session)

    for item in body.itens:
        if item.empresa_id not in emp_map:
            erros.append({"temp_id": item.temp_id, "erro": "Empresa inválida"})
            continue

        if not item.ignorar_duplicidade:
            dup_item = {
                "temp_id": item.temp_id,
                "empresa_id": item.empresa_id,
                "tipo": item.tipo,
                "valor": item.valor,
                "data_vencimento": item.data_vencimento,
                "codigo_barras": item.codigo_barras,
                "competencia": item.competencia,
                "file_hash": None,
            }
            alertas = detectar_duplicidade(dup_item, guias_db, [])
            if alertas:
                erros.append({"temp_id": item.temp_id, "erro": alertas[0]})
                continue

        try:
            guia_create = GuiaCreate(
                empresa_id=item.empresa_id,
                tipo=item.tipo,
                descricao=item.descricao,
                valor=item.valor,
                data_vencimento=item.data_vencimento,
                codigo_barras=item.codigo_barras,
                qr_code_pix=item.qr_code_pix,
                observacoes=item.observacoes,
                competencia=item.competencia,
                arquivo_guia=item.arquivo_guia,
            )
            guia = await _criar_guia_interna(
                user=user,
                guia_data=guia_create,
                emit_created=emit_lote,
                reminder_kind="nova_guia_lote",
            )
            if item.nome_arquivo_guia or item.tipo_arquivo_guia:
                await db.guias.update_one(
                    {"guia_id": guia["guia_id"]},
                    {
                        "$set": {
                            "nome_arquivo_guia": item.nome_arquivo_guia,
                            "tipo_arquivo_guia": item.tipo_arquivo_guia,
                        }
                    },
                )
            criadas.append(guia)
            guias_db.append(guia)
            if emit_lote:
                emp = emp_map[item.empresa_id]
                whatsapp = emp.get("whatsapp") or emp.get("telefone")
                if whatsapp and emp.get("notificacoes_whatsapp", True):
                    notificacoes_enviadas += 1
        except HTTPException as ex:
            erros.append({"temp_id": item.temp_id, "erro": ex.detail})
        except Exception as ex:
            erros.append({"temp_id": item.temp_id, "erro": str(ex)})

    await registrar_log(
        user["user_id"],
        "criar_lote",
        "guia",
        "",
        {"criadas": len(criadas), "erros": len(erros), "notificacoes": notificacoes_enviadas},
    )

    return {
        "criadas": len(criadas),
        "erros": erros,
        "guias": criadas,
        "notificacoes_enviadas": notificacoes_enviadas,
    }


@api_router.get("/guias")
async def listar_guias(
    status: Optional[str] = None,
    empresa_id: Optional[str] = None,
    vence_em: Optional[str] = Query(
        None,
        description="Janela de vencimento (calendário BR): hoje | 7 | 30. Exclui pagas. Combina com status e empresa_id.",
    ),
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Lista todas as guias do usuário com filtros opcionais"""
    user = await get_current_user(session_token, authorization)

    if vence_em is not None and vence_em not in ("hoje", "7", "30"):
        raise HTTPException(
            status_code=400,
            detail="Parâmetro vence_em inválido. Use: hoje, 7 ou 30",
        )

    # Construir filtro
    filtro = {"user_id": user["user_id"]}

    if status:
        filtro["status"] = status

    if empresa_id:
        filtro["empresa_id"] = empresa_id

    # Buscar guias
    guias = await db.guias.find(
        filtro,
        {"_id": 0},
    ).sort("data_vencimento", 1).to_list(1000)

    # Atualizar status das guias automaticamente
    for guia in guias:
        novo_status = calcular_status_guia(
            guia["data_vencimento"],
            guia["status"],
        )
        if novo_status != guia["status"]:
            await db.guias.update_one(
                {"guia_id": guia["guia_id"]},
                {"$set": {"status": novo_status}},
            )
            guia["status"] = novo_status

    if vence_em in ("hoje", "7", "30"):
        tz_br = ZoneInfo("America/Sao_Paulo")
        hoje = datetime.now(tz_br).date()

        def _dentro_do_prazo(g: dict) -> bool:
            if g.get("status") == "paga":
                return False
            vd = _parse_vencimento_para_date(str(g.get("data_vencimento", "")))
            if not vd:
                return False
            if vence_em == "hoje":
                return vd == hoje
            if vence_em == "7":
                return hoje <= vd <= hoje + timedelta(days=7)
            return hoje <= vd <= hoje + timedelta(days=30)

        guias = [g for g in guias if _dentro_do_prazo(g)]

    return guias

@api_router.get("/guias/{guia_id}")
async def obter_guia(
    guia_id: str,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Obtém uma guia específica"""
    user = await get_current_user(session_token, authorization)
    
    guia = await db.guias.find_one(
        {"guia_id": guia_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not guia:
        raise HTTPException(status_code=404, detail="Guia não encontrada")
    
    return guia


# Endpoint: envio manual de lembrete WhatsApp para guia específica.
@api_router.post("/guias/{guia_id}/enviar-lembrete")
async def enviar_lembrete_manual(
    guia_id: str,
    body: Optional[dict] = None,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Agenda lembrete manual via CommunicationCenter (fila + worker).

    Body opcional:
    {
      "telefone": "55XX...",        # opcional, sobrepõe o cadastro
      "mensagem_extra": "..."       # opcional, anexa nota do contador ao final
    }
    """
    user = await get_current_user(session_token, authorization)

    guia = await db.guias.find_one(
        {"guia_id": guia_id, "user_id": user["user_id"]},
        {"_id": 0},
    )
    if not guia:
        raise HTTPException(status_code=404, detail="Guia não encontrada")

    empresa = await db.empresas.find_one({"empresa_id": guia.get("empresa_id", "")})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa da guia não encontrada")

    body = body or {}
    telefone = (body.get("telefone") or empresa.get("whatsapp") or empresa.get("telefone") or "").strip()
    if not telefone:
        raise HTTPException(
            status_code=400,
            detail="Cliente sem WhatsApp/telefone cadastrado. Edite a empresa para adicionar.",
        )

    wctx = await _whatsapp_ctx_usuario(user["user_id"])
    if not wctx.get("conectado"):
        live, _ = _apibrasil_sessao_conectada(wctx["session"])
        if live:
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {
                    "$set": {
                        "whatsapp_conectado": True,
                        "whatsapp_session": wctx["session"],
                        "whatsapp_updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Conecte seu WhatsApp em Notificações > Configurações (QR Code) antes de enviar.",
            )

    valor_fmt = _formatar_valor_br(float(guia.get("valor") or 0))
    tipo = guia.get("tipo", "Guia")
    empresa_nome = empresa.get("nome_fantasia") or empresa.get("razao_social", "")
    venc_raw = guia.get("data_vencimento", "")
    venc_fmt = _formatar_data_br(venc_raw) or str(venc_raw)
    venc_date = _parse_vencimento_para_date(str(venc_raw))
    hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).date()

    if venc_date and venc_date < hoje:
        titulo = "GuiaControl — guia em atraso"
        situacao = (
            f"A guia *{tipo}* ({empresa_nome}) de *{valor_fmt}* está *em atraso* "
            f"(vencimento {venc_fmt}). Regularize o pagamento o quanto antes."
        )
    elif venc_date and venc_date == hoje:
        titulo = "GuiaControl — vence hoje"
        situacao = (
            f"A guia *{tipo}* ({empresa_nome}) no valor de *{valor_fmt}* *vence hoje* ({venc_fmt})."
        )
    else:
        titulo = "GuiaControl — lembrete de guia"
        situacao = (
            f"Lembrete da guia *{tipo}* ({empresa_nome}) no valor de *{valor_fmt}* "
            f"(vencimento {venc_fmt})."
        )

    link = await _link_portal_cliente(guia.get("empresa_id", ""))
    extra = (body.get("mensagem_extra") or "").strip()
    mensagem = f"*{titulo}*\n\n{situacao}"

    center = get_center()
    evt = await center.emit_manual_reminder(
        accountant_id=user["user_id"],
        empresa_id=guia.get("empresa_id", ""),
        guia_id=guia_id,
        phone=telefone,
        mensagem=mensagem,
        extra=extra,
        link=link,
    )

    return {
        "sucesso": True,
        "mensagem": "Lembrete agendado na Central de Comunicação (fila com delay inteligente).",
        "telefone": telefone,
        "preview": mensagem,
        "link": link,
        "event_id": evt.get("id"),
        "status": evt.get("status"),
    }

@api_router.put("/guias/{guia_id}")
async def atualizar_guia(
    guia_id: str,
    guia_data: GuiaUpdate,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Atualiza uma guia"""
    user = await get_current_user(session_token, authorization)
    
    guia = await db.guias.find_one({
        "guia_id": guia_id,
        "user_id": user["user_id"]
    })
    
    if not guia:
        raise HTTPException(status_code=404, detail="Guia não encontrada")
    
    update_data = {k: v for k, v in guia_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # Recalcular status se data de vencimento mudou e não está paga
    if "data_vencimento" in update_data and guia.get("status") != "paga":
        update_data["status"] = calcular_status_guia(
            update_data["data_vencimento"],
            guia.get("status", "a_vencer")
        )
    
    await db.guias.update_one(
        {"guia_id": guia_id},
        {"$set": update_data}
    )
    
    await registrar_log(user["user_id"], "editar", "guia", guia_id, {
        "campos_alterados": list(update_data.keys()),
    })
    
    guia_atualizada = await db.guias.find_one(
        {"guia_id": guia_id},
        {"_id": 0}
    )
    return guia_atualizada

@api_router.delete("/guias/{guia_id}")
async def deletar_guia(
    guia_id: str,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Deleta uma guia"""
    user = await get_current_user(session_token, authorization)
    
    guia = await db.guias.find_one({
        "guia_id": guia_id,
        "user_id": user["user_id"]
    })
    
    if not guia:
        raise HTTPException(status_code=404, detail="Guia não encontrada")
    
    await db.guias.delete_one({
        "guia_id": guia_id,
        "user_id": user["user_id"]
    })
    
    await registrar_log(user["user_id"], "excluir", "guia", guia_id, {
        "tipo": guia.get("tipo"),
        "valor": guia.get("valor"),
    })
    
    return {"message": "Guia deletada com sucesso"}


@api_router.post("/guias/{guia_id}/marcar-paga")
async def marcar_guia_paga(
    guia_id: str,
    comprovante_data: Optional[ComprovanteUpload] = None,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Marca uma guia como paga e opcionalmente anexa comprovante"""
    user = await get_current_user(session_token, authorization)
    
    guia = await db.guias.find_one({
        "guia_id": guia_id,
        "user_id": user["user_id"]
    })
    
    if not guia:
        raise HTTPException(status_code=404, detail="Guia não encontrada")
    
    # Não permitir duplicidade de pagamento
    if guia.get("status") == "paga":
        raise HTTPException(status_code=400, detail="Esta guia já está marcada como paga")
    
    update_data = {
        "status": "paga",
        "data_pagamento": datetime.now().strftime("%Y-%m-%d"),
        "updated_at": datetime.now(timezone.utc)
    }
    
    if comprovante_data and comprovante_data.comprovante:
        update_data["comprovante"] = comprovante_data.comprovante
    
    await db.guias.update_one(
        {"guia_id": guia_id},
        {"$set": update_data}
    )
    
    await registrar_log(user["user_id"], "pagar", "guia", guia_id, {
        "tipo": guia.get("tipo"),
        "valor": guia.get("valor"),
        "com_comprovante": bool(comprovante_data and comprovante_data.comprovante),
    })
    
    guia_atualizada = await db.guias.find_one(
        {"guia_id": guia_id},
        {"_id": 0}
    )
    return guia_atualizada


# Alias PATCH para pagamento
@api_router.patch("/guias/{guia_id}/pagar")
async def pagar_guia(
    guia_id: str,
    comprovante_data: Optional[ComprovanteUpload] = None,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Alias PATCH para confirmar pagamento"""
    return await marcar_guia_paga(guia_id, comprovante_data, session_token, authorization)


# ============ LOGS ROUTES ============

@api_router.get("/logs")
async def listar_logs(
    entidade: Optional[str] = None,
    limit: int = 50,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Lista os logs de ações do usuário"""
    user = await get_current_user(session_token, authorization)
    
    query = {"user_id": user["user_id"]}
    if entidade:
        query["entidade"] = entidade
    
    cursor = db.action_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    logs = await cursor.to_list(length=limit)
    return logs


# ============ NOTIFICAÇÕES ROUTES ============

@api_router.get("/notificacoes")
async def listar_notificacoes(
    canal: Optional[str] = None,
    empresa_id: Optional[str] = None,
    limit: int = 50,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Lista o histórico de notificações enviadas"""
    user = await get_current_user(session_token, authorization)
    
    query: dict = {"user_id": user["user_id"]}
    if canal:
        query["canal"] = canal
    if empresa_id:
        query["empresa_id"] = empresa_id
    
    cursor = db.notificacoes.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    notifs = await cursor.to_list(length=limit)
    return notifs


@api_router.post("/notificacoes/enviar-teste")
async def enviar_notificacao_teste(
    body: dict,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """
    Envia uma notificação de teste para verificar a integração.
    Body: {"telefone": "51999999999", "mensagem": "Teste de notificação"}
    """
    user = await get_current_user(session_token, authorization)
    
    telefone = body.get("telefone", "")
    mensagem = body.get("mensagem", "Teste de notificação do GuiaControl")
    
    if not telefone:
        raise HTTPException(status_code=400, detail="Telefone é obrigatório")

    wctx = await _whatsapp_ctx_usuario(user["user_id"])
    wa_session = wctx["session"] if wctx.get("conectado") else None
    if not wa_session:
        live, _ = _apibrasil_sessao_conectada(wctx["session"])
        if live:
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {
                    "$set": {
                        "whatsapp_conectado": True,
                        "whatsapp_session": wctx["session"],
                        "whatsapp_updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
            wa_session = wctx["session"]
        else:
            raise HTTPException(
                status_code=400,
                detail="Conecte seu WhatsApp em Notificacoes > Configuracoes (QR Code) antes de enviar.",
            )

    resultado = await get_center().emit_test(
        accountant_id=user["user_id"],
        phone=telefone,
        mensagem=mensagem,
    )
    
    return {
        "sucesso": True,
        "mensagem": "Mensagem de teste enviada para a fila — deve chegar em segundos no WhatsApp.",
        "detalhes": resultado,
    }


@api_router.post("/notificacoes/executar-job")
async def executar_job_notificacoes(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Executa manualmente o job de verificação e envio de notificações"""
    user = await get_current_user(session_token, authorization)
    
    resultados = await verificar_e_notificar_guias(user["user_id"])
    
    return {
        "mensagem": "Job executado com sucesso",
        "resultados": resultados,
    }


@api_router.post("/cron/notificacoes-vencimento")
async def cron_notificacoes_vencimento(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
):
    """
    Executa o job de lembretes para todos os usuários.
    Protegido por CRON_SECRET (header X-Cron-Secret), para agendadores externos.
    """
    expected = os.getenv("CRON_SECRET", "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="CRON_SECRET não configurado no servidor",
        )
    if (x_cron_secret or "").strip() != expected:
        raise HTTPException(status_code=401, detail="Não autorizado")

    resultados = await verificar_e_notificar_guias(None)
    return {"ok": True, "resultados": resultados}


@api_router.post("/whatsapp/conectar")
async def whatsapp_conectar(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """
    Inicia sessao WhatsApp do contador e retorna QR Code (APIBrasil /whatsapp/start).
    O contador escaneia com o app WhatsApp no celular (Aparelhos conectados).
    Os disparos usam esta sessao (numero do escritorio).
    """
    user = await get_current_user(session_token, authorization)
    user_id = user["user_id"]
    wa_session = _whatsapp_session_for_user(user_id)
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "whatsapp_session": wa_session,
                "whatsapp_conectado": False,
                "whatsapp_updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=False,
    )

    from communication.providers.factory import get_communication_provider

    provider = get_communication_provider()
    if hasattr(provider, "configured") and not provider.configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "APIBrasil nao configurada. Defina APIBRASIL_BEARER_TOKEN e "
                "APIBRASIL_DEVICE_TOKEN no backend/.env e reinicie a API."
            ),
        )

    if hasattr(provider, "start_session"):
        resultado = await provider.start_session(wa_session)
    else:
        resultado = _apibrasil_start_session(wa_session)

    if resultado.get("conectado"):
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "whatsapp_conectado": True,
                    "whatsapp_session": wa_session,
                    "whatsapp_updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        return {
            "session": wa_session,
            "conectado": True,
            "qrcode_data_uri": resultado.get("qrcode_data_uri"),
            "send_session_enabled": os.getenv("APIBRASIL_SEND_SESSION", "true").strip().lower()
            not in ("0", "false", "no", "off"),
            "mensagem": "WhatsApp ja conectado. Os disparos usarao este numero do escritorio.",
            "detalhes": resultado,
        }

    if not resultado.get("sucesso") and not resultado.get("qrcode_data_uri"):
        raise HTTPException(
            status_code=502,
            detail=resultado.get("erro") or "Nao foi possivel gerar o QR Code na APIBrasil.",
        )
    return {
        "session": wa_session,
        "conectado": bool(resultado.get("conectado")),
        "qrcode_data_uri": resultado.get("qrcode_data_uri"),
        "send_session_enabled": os.getenv("APIBRASIL_SEND_SESSION", "true").strip().lower()
        not in ("0", "false", "no", "off"),
        "mensagem": (
            "WhatsApp ja conectado. Os disparos usarao este numero do escritorio."
            if resultado.get("conectado")
            else "Escaneie o QR Code no WhatsApp do celular do escritorio (Aparelhos conectados)."
        ),
        "detalhes": resultado,
    }


@api_router.get("/whatsapp/status")
async def whatsapp_status(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Status da conexao WhatsApp do contador logado (com sync ao vivo)."""
    user = await get_current_user(session_token, authorization)
    status = await _status_whatsapp_contador(user["user_id"])
    status["send_session_enabled"] = os.getenv("APIBRASIL_SEND_SESSION", "true").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )
    status["require_session"] = os.getenv("APIBRASIL_REQUIRE_SESSION", "true").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )
    return status


@api_router.post("/whatsapp/desconectar")
async def whatsapp_desconectar(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Desconecta o WhatsApp do escritorio (tenta logout na APIBrasil + limpa flag local)."""
    user = await get_current_user(session_token, authorization)
    user_id = user["user_id"]
    ctx = await _whatsapp_ctx_usuario(user_id)
    session = ctx.get("session") or _whatsapp_session_for_user(user_id)

    logout_result: dict = {"sucesso": False}
    from communication.providers.factory import get_communication_provider

    provider = get_communication_provider()
    if hasattr(provider, "logout_session"):
        logout_result = await provider.logout_session(session)

    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "whatsapp_conectado": False,
                "whatsapp_updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return {
        "ok": True,
        "mensagem": (
            "WhatsApp desconectado na APIBrasil e no app. Gere um novo QR para reconectar."
            if logout_result.get("sucesso")
            else "Sessao desvinculada no app. Se o aparelho continuar conectado na APIBrasil, "
            "remova em Aparelhos conectados no WhatsApp e gere um novo QR."
        ),
        "logout_remoto": logout_result,
    }


@api_router.get("/notificacoes/status-whatsapp")
async def verificar_status_whatsapp(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Status WhatsApp do contador + plataforma APIBrasil."""
    user = await get_current_user(session_token, authorization)
    status = await _status_whatsapp_contador(user["user_id"])
    status["send_session_enabled"] = os.getenv("APIBRASIL_SEND_SESSION", "true").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )
    return status


@api_router.get("/notificacoes/status-zapi")
async def verificar_status_zapi(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Alias legado da tela de notificações; resposta é da APIBrasil."""
    await get_current_user(session_token, authorization)
    return _status_whatsapp_apibrasil()


# ============ DASHBOARD ROUTES ============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def obter_estatisticas(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Obtém estatísticas do dashboard"""
    user = await get_current_user(session_token, authorization)
    
    # Buscar todas as guias do usuário
    todas_guias = await db.guias.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(10000)
    
    # Atualizar status antes de calcular
    for guia in todas_guias:
        novo_status = calcular_status_guia(
            guia["data_vencimento"], 
            guia["status"]
        )
        if novo_status != guia["status"]:
            await db.guias.update_one(
                {"guia_id": guia["guia_id"]},
                {"$set": {"status": novo_status}}
            )
            guia["status"] = novo_status
    
    # Calcular estatísticas
    total_guias = len(todas_guias)
    guias_pagas = [g for g in todas_guias if g["status"] == "paga"]
    guias_vencidas = [g for g in todas_guias if g["status"] == "vencida"]
    guias_a_vencer = [g for g in todas_guias if g["status"] == "a_vencer"]
    
    stats = DashboardStats(
        total_guias=total_guias,
        guias_pagas=len(guias_pagas),
        guias_vencidas=len(guias_vencidas),
        guias_a_vencer=len(guias_a_vencer),
        valor_total_pago=sum(g["valor"] for g in guias_pagas),
        valor_total_vencido=sum(g["valor"] for g in guias_vencidas),
        valor_total_a_vencer=sum(g["valor"] for g in guias_a_vencer)
    )
    
    return stats


@api_router.get("/dashboard/insights", response_model=DashboardInsights)
async def obter_dashboard_insights(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Insights operacionais: alertas, pendências, gráficos e ranking de clientes."""
    from collections import defaultdict
    from datetime import timedelta

    user = await get_current_user(session_token, authorization)
    uid = user["user_id"]
    hoje = datetime.now(timezone.utc).date()

    todas_guias = await db.guias.find({"user_id": uid}, {"_id": 0}).to_list(10000)
    empresas = await db.empresas.find({"user_id": uid}, {"_id": 0}).to_list(5000)
    emp_map = {e["empresa_id"]: e for e in empresas}

    for guia in todas_guias:
        novo = calcular_status_guia(guia["data_vencimento"], guia["status"])
        if novo != guia["status"]:
            await db.guias.update_one(
                {"guia_id": guia["guia_id"]},
                {"$set": {"status": novo}},
            )
            guia["status"] = novo

    pagas = [g for g in todas_guias if g["status"] == "paga"]
    vencidas = [g for g in todas_guias if g["status"] == "vencida"]
    a_vencer = [g for g in todas_guias if g["status"] == "a_vencer"]

    vence_hoje: List[dict] = []
    vence_amanha: List[dict] = []
    proximos_7 = 0
    for g in a_vencer + vencidas:
        dv = _parse_vencimento_para_date(g.get("data_vencimento", ""))
        if not dv:
            continue
        delta = (dv - hoje).days
        if delta == 0 and g["status"] != "paga":
            vence_hoje.append(g)
        if delta == 1:
            vence_amanha.append(g)
        if 0 <= delta <= 7 and g["status"] == "a_vencer":
            proximos_7 += 1

    empresas_com_vencida = len({g["empresa_id"] for g in vencidas})
    cutoff_30 = hoje - timedelta(days=30)
    total_recuperado = 0.0
    economia_estimada = 0.0
    for g in pagas:
        dp = g.get("data_pagamento")
        if not dp:
            continue
        d_pag = _parse_vencimento_para_date(str(dp)[:10])
        if d_pag and d_pag >= cutoff_30:
            total_recuperado += float(g.get("valor") or 0)
            dv = _parse_vencimento_para_date(g.get("data_vencimento", ""))
            if dv and d_pag <= dv:
                economia_estimada += float(g.get("valor") or 0) * 0.02

    notifs = await db.notificacoes.find(
        {"user_id": uid, "sucesso": True},
        {"_id": 0, "guia_id": 1, "empresa_id": 1},
    ).to_list(5000)
    guias_com_lembrete = {n["guia_id"] for n in notifs if n.get("guia_id")}
    guias_abertas_com_lembrete = [
        g
        for g in a_vencer + vencidas
        if g["guia_id"] in guias_com_lembrete
    ]
    empresas_lembrete_sem_pagar = len({g["empresa_id"] for g in guias_abertas_com_lembrete})

    pagas_recentes = [
        g
        for g in pagas
        if g.get("data_pagamento")
        and _parse_vencimento_para_date(str(g["data_pagamento"])[:10])
        and _parse_vencimento_para_date(str(g["data_pagamento"])[:10]) >= hoje - timedelta(days=7)
    ]

    alerts: List[DashboardAlert] = []
    if empresas_lembrete_sem_pagar:
        alerts.append(
            DashboardAlert(
                id="nao_visualizou",
                severity="warning",
                icon="eye-off",
                message=f"{empresas_lembrete_sem_pagar} cliente(s) com lembrete enviado e guia em aberto",
            )
        )
    if vence_amanha:
        alerts.append(
            DashboardAlert(
                id="vence_amanha",
                severity="warning",
                icon="alarm",
                message=f"{len(vence_amanha)} guia(s) vencem amanhã",
            )
        )
    if vencidas:
        alerts.append(
            DashboardAlert(
                id="vencidas",
                severity="warning",
                icon="alert-circle",
                message=f"{len(vencidas)} guia(s) vencida(s) — ação imediata",
            )
        )
    if pagas_recentes:
        alerts.append(
            DashboardAlert(
                id="pagamento_auto",
                severity="success",
                icon="checkmark-circle",
                message=f"{len(pagas_recentes)} pagamento(s) confirmado(s) na última semana",
            )
        )
    aguardando_conf = [g for g in a_vencer if g.get("comprovante") and not g.get("data_pagamento")]
    if aguardando_conf:
        alerts.append(
            DashboardAlert(
                id="aguardando_conf",
                severity="info",
                icon="hourglass",
                message=f"{len(aguardando_conf)} guia(s) aguardando confirmação do contador",
            )
        )

    atrasos_por_empresa: dict = defaultdict(int)
    for g in vencidas:
        atrasos_por_empresa[g["empresa_id"]] += 1
    recorrentes = [eid for eid, c in atrasos_por_empresa.items() if c >= 2]
    if recorrentes:
        nome = (
            emp_map.get(recorrentes[0], {}).get("nome_fantasia")
            or emp_map.get(recorrentes[0], {}).get("razao_social")
            or "Cliente"
        )
        alerts.append(
            DashboardAlert(
                id="recorrencia",
                severity="warning",
                icon="repeat",
                message=f"Recorrência de atraso: {nome}"
                + (f" e mais {len(recorrentes) - 1}" if len(recorrentes) > 1 else ""),
            )
        )

    chart_status = [
        {"label": "Pagas", "value": len(pagas), "color": "#10B981"},
        {"label": "A vencer", "value": len(a_vencer), "color": "#F59E0B"},
        {"label": "Vencidas", "value": len(vencidas), "color": "#EF4444"},
    ]

    monthly: dict = defaultdict(lambda: {"pagas": 0, "abertas": 0, "label": ""})
    for i in range(5, -1, -1):
        primeiro = (hoje.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
        key = primeiro.strftime("%Y-%m")
        monthly[key]["label"] = primeiro.strftime("%b")

    for g in todas_guias:
        dv = _parse_vencimento_para_date(g.get("data_vencimento", ""))
        if dv:
            key = dv.strftime("%Y-%m")
            if key in monthly:
                if g["status"] == "paga":
                    monthly[key]["pagas"] += 1
                else:
                    monthly[key]["abertas"] += 1
        dp = g.get("data_pagamento")
        if g["status"] == "paga" and dp:
            d_pag = _parse_vencimento_para_date(str(dp)[:10])
            if d_pag:
                key = d_pag.strftime("%Y-%m")
                if key in monthly:
                    monthly[key]["pagas"] = monthly[key].get("pagas", 0) + 0  # já contado

    chart_monthly = [
        {"month": v["label"] or k, "pagas": v["pagas"], "abertas": v["abertas"]}
        for k, v in sorted(monthly.items())
    ]

    def _nome_empresa(eid: str) -> str:
        e = emp_map.get(eid, {})
        return e.get("nome_fantasia") or e.get("razao_social") or "Empresa"

    ranking_atraso = sorted(
        [{"empresa_id": eid, "nome": _nome_empresa(eid), "vencidas": c} for eid, c in atrasos_por_empresa.items()],
        key=lambda x: x["vencidas"],
        reverse=True,
    )[:5]

    pagas_por_empresa: dict = defaultdict(int)
    for g in pagas:
        pagas_por_empresa[g["empresa_id"]] += 1
    organizadas = sorted(
        [
            {"empresa_id": eid, "nome": _nome_empresa(eid), "pagas": c}
            for eid, c in pagas_por_empresa.items()
            if eid not in atrasos_por_empresa
        ],
        key=lambda x: x["pagas"],
        reverse=True,
    )[:5]

    media_pagamento_dias = 0
    amostras = 0
    for g in pagas:
        dv = _parse_vencimento_para_date(g.get("data_vencimento", ""))
        dp = _parse_vencimento_para_date(str(g.get("data_pagamento", ""))[:10])
        if dv and dp:
            media_pagamento_dias += (dp - dv).days
            amostras += 1
    media_dias = round(media_pagamento_dias / amostras, 1) if amostras else 0

    return DashboardInsights(
        widgets={
            "total_aberto": sum(g["valor"] for g in vencidas + a_vencer),
            "guias_vencidas": len(vencidas),
            "guias_pagas": len(pagas),
            "guias_a_vencer": len(a_vencer),
            "proximos_vencimentos": proximos_7,
            "clientes_em_atraso": empresas_com_vencida,
            "total_recuperado": round(total_recuperado, 2),
            "economia_multas": round(economia_estimada, 2),
            "vence_hoje": len(vence_hoje),
        },
        pendencias={
            "vencidas": {
                "count": len(vencidas),
                "valor": sum(g["valor"] for g in vencidas),
            },
            "hoje": {
                "count": len(vence_hoje),
                "valor": sum(g["valor"] for g in vence_hoje),
            },
            "aguardando": {
                "count": len(a_vencer),
                "valor": sum(g["valor"] for g in a_vencer),
            },
            "concluidas": {
                "count": len(pagas),
                "valor": sum(g["valor"] for g in pagas),
            },
        },
        alerts=alerts[:8],
        chart_status=chart_status,
        chart_monthly=chart_monthly,
        empresas_insights={
            "mais_atrasam": ranking_atraso,
            "mais_organizadas": organizadas,
            "media_dias_pagamento": media_dias,
            "total_empresas": len(empresas),
        },
    )


# ============ ADMIN AREA ============

def _admin_emails() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS", "") or ""
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _is_admin_email(email: Optional[str]) -> bool:
    if not email:
        return False
    return email.strip().lower() in _admin_emails()


async def require_admin(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> dict:
    user = await get_current_user(session_token, authorization)
    if not _is_admin_email(user.get("email")):
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user


def _user_phone(u: dict) -> Optional[str]:
    """Retorna o telefone do contador (campo admin > whatsapp setup)."""
    return (
        (u.get("telefone_admin") or "").strip()
        or (u.get("whatsapp_telefone") or "").strip()
        or None
    )


admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

from fastapi import Depends as _AdminDepends  # alias local


@admin_router.get("/me")
async def admin_me(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    """Diz se o usuário logado é admin (não retorna 403 — devolve flag)."""
    try:
        user = await get_current_user(session_token, authorization)
    except HTTPException:
        return {"is_admin": False, "user": None}
    return {
        "is_admin": _is_admin_email(user.get("email")),
        "user": {
            "user_id": user.get("user_id"),
            "email": user.get("email"),
            "name": user.get("name"),
        },
    }


@admin_router.get("/overview")
async def admin_overview(admin: dict = _AdminDepends(require_admin)):
    """Dashboard de dono — métricas SaaS globais."""
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)
    last_30d = now - timedelta(days=30)
    last_60d = now - timedelta(days=60)

    # ===== USUÁRIOS / CONTADORES =====
    total_users = await db.users.count_documents({})
    novos_24h = await db.users.count_documents({"created_at": {"$gte": last_24h}})
    novos_7d = await db.users.count_documents({"created_at": {"$gte": last_7d}})
    novos_30d = await db.users.count_documents({"created_at": {"$gte": last_30d}})
    novos_30d_anterior = await db.users.count_documents(
        {"created_at": {"$gte": last_60d, "$lt": last_30d}}
    )
    crescimento_30d_pct = (
        round(((novos_30d - novos_30d_anterior) / novos_30d_anterior) * 100, 1)
        if novos_30d_anterior > 0
        else (100.0 if novos_30d > 0 else 0.0)
    )

    # Sessões / acessos
    sessoes_24h_uids = await db.user_sessions.distinct("user_id", {"created_at": {"$gte": last_24h}})
    sessoes_7d_uids = await db.user_sessions.distinct("user_id", {"created_at": {"$gte": last_7d}})
    sessoes_30d_uids = await db.user_sessions.distinct("user_id", {"created_at": {"$gte": last_30d}})
    total_sessoes_7d = await db.user_sessions.count_documents({"created_at": {"$gte": last_7d}})

    # Conversão: cadastrados que ao menos criaram 1 empresa
    user_ids_com_empresa = await db.empresas.distinct("user_id")
    user_ids_com_guia = await db.guias.distinct("user_id")
    ativos_count = len(set(user_ids_com_empresa) | set(user_ids_com_guia))
    inativos_count = max(0, total_users - ativos_count)
    conversao_pct = round((ativos_count / total_users) * 100, 1) if total_users > 0 else 0.0

    # ===== EMPRESAS / GUIAS =====
    total_empresas = await db.empresas.count_documents({})
    novas_empresas_30d = await db.empresas.count_documents({"created_at": {"$gte": last_30d}})

    total_guias = await db.guias.count_documents({})
    guias_pagas = await db.guias.count_documents({"status": "paga"})
    guias_vencidas = await db.guias.count_documents({"status": "vencida"})
    guias_a_vencer = await db.guias.count_documents({"status": "a_vencer"})
    novas_guias_30d = await db.guias.count_documents({"created_at": {"$gte": last_30d}})

    valor_aberto = 0.0
    valor_pago = 0.0
    async for g in db.guias.find({}, {"valor": 1, "status": 1}):
        try:
            v = float(g.get("valor") or 0)
            if g.get("status") in ("a_vencer", "vencida"):
                valor_aberto += v
            elif g.get("status") == "paga":
                valor_pago += v
        except Exception:
            pass

    # ===== NOTIFICAÇÕES =====
    notif_total = await db.notificacoes.count_documents({})
    notif_ok = await db.notificacoes.count_documents({"sucesso": True})
    notif_erro = await db.notificacoes.count_documents({"sucesso": False})
    notif_7d = await db.notificacoes.count_documents({"created_at": {"$gte": last_7d}})
    notif_24h = await db.notificacoes.count_documents({"created_at": {"$gte": last_24h}})
    taxa_sucesso = round((notif_ok / notif_total) * 100, 1) if notif_total > 0 else 0.0

    # ===== CRESCIMENTO MENSAL (últimos 6 meses) =====
    # Cadastros e guias por mês
    pipeline_users = [
        {"$match": {"created_at": {"$gte": now - timedelta(days=180)}}},
        {
            "$group": {
                "_id": {
                    "y": {"$year": "$created_at"},
                    "m": {"$month": "$created_at"},
                },
                "total": {"$sum": 1},
            }
        },
        {"$sort": {"_id.y": 1, "_id.m": 1}},
    ]
    users_por_mes = []
    async for r in db.users.aggregate(pipeline_users):
        users_por_mes.append(
            {
                "ano": r["_id"]["y"],
                "mes": r["_id"]["m"],
                "label": f"{r['_id']['m']:02d}/{str(r['_id']['y'])[-2:]}",
                "total": r["total"],
            }
        )

    pipeline_guias = [
        {"$match": {"created_at": {"$gte": now - timedelta(days=180)}}},
        {
            "$group": {
                "_id": {
                    "y": {"$year": "$created_at"},
                    "m": {"$month": "$created_at"},
                },
                "total": {"$sum": 1},
            }
        },
        {"$sort": {"_id.y": 1, "_id.m": 1}},
    ]
    guias_por_mes = []
    async for r in db.guias.aggregate(pipeline_guias):
        guias_por_mes.append(
            {
                "ano": r["_id"]["y"],
                "mes": r["_id"]["m"],
                "label": f"{r['_id']['m']:02d}/{str(r['_id']['y'])[-2:]}",
                "total": r["total"],
            }
        )

    # ===== ACESSOS POR DIA (últimos 14 dias) =====
    pipeline_acessos = [
        {"$match": {"created_at": {"$gte": now - timedelta(days=14)}}},
        {
            "$group": {
                "_id": {
                    "y": {"$year": "$created_at"},
                    "m": {"$month": "$created_at"},
                    "d": {"$dayOfMonth": "$created_at"},
                },
                "total": {"$sum": 1},
            }
        },
        {"$sort": {"_id.y": 1, "_id.m": 1, "_id.d": 1}},
    ]
    acessos_por_dia = []
    async for r in db.user_sessions.aggregate(pipeline_acessos):
        d = r["_id"]
        acessos_por_dia.append(
            {
                "label": f"{d['d']:02d}/{d['m']:02d}",
                "total": r["total"],
            }
        )

    # ===== TOP CONTADORES POR ENGAJAMENTO =====
    top_pipeline = [
        {"$group": {"_id": "$user_id", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 10},
    ]
    top_guias = []
    async for r in db.guias.aggregate(top_pipeline):
        top_guias.append({"user_id": r["_id"], "total": r["total"]})
    if top_guias:
        ids = [t["user_id"] for t in top_guias]
        users_info = {}
        async for u in db.users.find(
            {"user_id": {"$in": ids}},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1},
        ):
            users_info[u["user_id"]] = u
        for t in top_guias:
            info = users_info.get(t["user_id"]) or {}
            t["name"] = info.get("name") or "—"
            t["email"] = info.get("email") or ""
            t["empresas"] = await db.empresas.count_documents({"user_id": t["user_id"]})

    # ===== ÚLTIMOS CADASTROS (5 mais recentes) =====
    ultimos_cadastros = []
    async for u in db.users.find(
        {}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5):
        ultimos_cadastros.append(u)

    return {
        "users": {
            "total": total_users,
            "ativos": ativos_count,
            "inativos": inativos_count,
            "conversao_pct": conversao_pct,
            "novos_24h": novos_24h,
            "novos_7d": novos_7d,
            "novos_30d": novos_30d,
            "crescimento_30d_pct": crescimento_30d_pct,
        },
        "acessos": {
            "ativos_24h": len(sessoes_24h_uids),
            "ativos_7d": len(sessoes_7d_uids),
            "ativos_30d": len(sessoes_30d_uids),
            "sessoes_7d": total_sessoes_7d,
        },
        "empresas": {
            "total": total_empresas,
            "novas_30d": novas_empresas_30d,
        },
        "guias": {
            "total": total_guias,
            "pagas": guias_pagas,
            "vencidas": guias_vencidas,
            "a_vencer": guias_a_vencer,
            "novas_30d": novas_guias_30d,
            "valor_em_aberto": round(valor_aberto, 2),
            "valor_pago": round(valor_pago, 2),
        },
        "notificacoes": {
            "total": notif_total,
            "sucesso": notif_ok,
            "erro": notif_erro,
            "ultimos_24h": notif_24h,
            "ultimos_7d": notif_7d,
            "taxa_sucesso_pct": taxa_sucesso,
        },
        "graficos": {
            "users_por_mes": users_por_mes,
            "guias_por_mes": guias_por_mes,
            "acessos_por_dia": acessos_por_dia,
        },
        "top_contadores": top_guias,
        "ultimos_cadastros": ultimos_cadastros,
        "generated_at": now.isoformat(),
    }


@admin_router.get("/users")
async def admin_users(
    search: Optional[str] = None,
    admin: dict = _AdminDepends(require_admin),
):
    """Lista todos os contadores cadastrados (com contagens)."""
    query: dict = {}
    if search:
        s = search.strip()
        query = {
            "$or": [
                {"email": {"$regex": re.escape(s), "$options": "i"}},
                {"name": {"$regex": re.escape(s), "$options": "i"}},
            ]
        }

    cursor = db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1)
    users = await cursor.to_list(length=500)

    enriched = []
    admin_set = _admin_emails()
    for u in users:
        uid = u.get("user_id")
        emp_count = await db.empresas.count_documents({"user_id": uid})
        guias_count = await db.guias.count_documents({"user_id": uid})
        guias_pagas = await db.guias.count_documents({"user_id": uid, "status": "paga"})
        guias_vencidas = await db.guias.count_documents({"user_id": uid, "status": "vencida"})
        last_session = await db.user_sessions.find_one(
            {"user_id": uid}, sort=[("created_at", -1)], projection={"_id": 0, "created_at": 1}
        )
        enriched.append(
            {
                "user_id": uid,
                "email": u.get("email"),
                "name": u.get("name"),
                "picture": u.get("picture"),
                "created_at": u.get("created_at"),
                "telefone": _user_phone(u),
                "telefone_admin": u.get("telefone_admin"),
                "whatsapp_telefone": u.get("whatsapp_telefone"),
                "bloqueado": bool(u.get("bloqueado", False)),
                "is_admin": _is_admin_email(u.get("email")) or u.get("email", "").lower() in admin_set,
                "empresas_count": emp_count,
                "guias_count": guias_count,
                "guias_pagas": guias_pagas,
                "guias_vencidas": guias_vencidas,
                "last_session_at": (last_session or {}).get("created_at"),
            }
        )
    return {"items": enriched, "total": len(enriched)}


class AdminUserPatch(BaseModel):
    telefone_admin: Optional[str] = None
    bloqueado: Optional[bool] = None
    password: Optional[str] = None


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    telefone_admin: Optional[str] = None


@admin_router.post("/users")
async def admin_user_create(
    body: AdminUserCreate,
    admin: dict = _AdminDepends(require_admin),
):
    """Cria um contador manualmente (login + senha definidos pelo admin)."""
    name = (body.name or "").strip()
    email_norm = (body.email or "").strip().lower()
    password = body.password or ""

    if not name:
        raise HTTPException(status_code=400, detail="Nome é obrigatório")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Senha precisa ter ao menos 6 caracteres")
    if await db.users.find_one({"email": email_norm}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado")

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt(rounds=12)
    ).decode("ascii")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    telefone_admin = re.sub(r"\D", "", body.telefone_admin or "") or None
    user_doc = {
        "user_id": user_id,
        "email": email_norm,
        "name": name,
        "picture": None,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc),
        "created_by_admin": admin.get("user_id"),
    }
    if telefone_admin:
        user_doc["telefone_admin"] = telefone_admin
    await db.users.insert_one(user_doc)
    await registrar_log(
        admin["user_id"],
        "admin_create_user",
        "user",
        user_id,
        {"email": email_norm, "name": name, "phone": telefone_admin or ""},
    )
    return {
        "ok": True,
        "user": {
            "user_id": user_id,
            "email": email_norm,
            "name": name,
            "telefone": telefone_admin,
        },
    }


@admin_router.patch("/users/{user_id}")
async def admin_user_patch(
    user_id: str,
    body: AdminUserPatch,
    admin: dict = _AdminDepends(require_admin),
):
    update: dict = {}
    if body.telefone_admin is not None:
        update["telefone_admin"] = re.sub(r"\D", "", body.telefone_admin or "") or None
    if body.bloqueado is not None:
        update["bloqueado"] = bool(body.bloqueado)
    if body.password is not None:
        if len(body.password) < 6:
            raise HTTPException(status_code=400, detail="Senha precisa ter ao menos 6 caracteres")
        update["password_hash"] = bcrypt.hashpw(
            body.password.encode("utf-8"), bcrypt.gensalt(rounds=12)
        ).decode("ascii")
    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    update["updated_at"] = datetime.now(timezone.utc)

    result = await db.users.update_one({"user_id": user_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Se bloqueou OU resetou senha, encerra todas as sessões ativas
    if update.get("bloqueado") is True or "password_hash" in update:
        await db.user_sessions.delete_many({"user_id": user_id})

    await registrar_log(
        admin["user_id"],
        "admin_update_user",
        "user",
        user_id,
        {
            "changes": {
                k: ("***" if k == "password_hash" else v)
                for k, v in update.items()
                if k != "updated_at"
            }
        },
    )
    return {"ok": True}


@admin_router.delete("/users/{user_id}")
async def admin_user_delete(user_id: str, admin: dict = _AdminDepends(require_admin)):
    if user_id == admin.get("user_id"):
        raise HTTPException(status_code=400, detail="Você não pode excluir sua própria conta")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if _is_admin_email(user.get("email")):
        raise HTTPException(status_code=400, detail="Não é possível excluir outro admin pelo painel")

    # Cascade
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.notificacoes.delete_many({"user_id": user_id})
    await db.logs.delete_many({"user_id": user_id})
    await db.guias.delete_many({"user_id": user_id})
    await db.empresas.delete_many({"user_id": user_id})
    await db.users.delete_one({"user_id": user_id})

    await registrar_log(admin["user_id"], "admin_delete_user", "user", user_id, {"email": user.get("email")})
    return {"ok": True}


@admin_router.post("/users/{user_id}/impersonate")
async def admin_user_impersonate(
    user_id: str,
    response: Response,
    admin: dict = _AdminDepends(require_admin),
):
    """Gera uma sessão como o usuário-alvo. Ideal para suporte."""
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if target.get("bloqueado"):
        raise HTTPException(status_code=400, detail="Usuário bloqueado — desbloqueie para impersonar")

    session_token, _user = await _commit_session(user_id, response)
    await registrar_log(
        admin["user_id"],
        "admin_impersonate",
        "user",
        user_id,
        {"email": target.get("email")},
    )
    return {
        "ok": True,
        "session_token": session_token,
        "user": {
            "user_id": target.get("user_id"),
            "email": target.get("email"),
            "name": target.get("name"),
            "picture": target.get("picture"),
        },
    }


@admin_router.get("/empresas")
async def admin_empresas(
    search: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 200,
    admin: dict = _AdminDepends(require_admin),
):
    query: dict = {}
    if user_id:
        query["user_id"] = user_id
    if search:
        s = re.escape(search.strip())
        query = {
            **query,
            "$or": [
                {"razao_social": {"$regex": s, "$options": "i"}},
                {"nome_fantasia": {"$regex": s, "$options": "i"}},
                {"cnpj": {"$regex": s, "$options": "i"}},
            ],
        }
    cursor = db.empresas.find(query, {"_id": 0}).sort("created_at", -1).limit(min(int(limit or 200), 500))
    items = await cursor.to_list(length=500)

    # Anexar nome do contador dono
    user_ids = list({i.get("user_id") for i in items if i.get("user_id")})
    owners = {}
    if user_ids:
        async for u in db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}):
            owners[u["user_id"]] = u

    for i in items:
        owner = owners.get(i.get("user_id")) or {}
        i["owner_name"] = owner.get("name")
        i["owner_email"] = owner.get("email")

    return {"items": items, "total": len(items)}


@admin_router.get("/guias")
async def admin_guias(
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 200,
    admin: dict = _AdminDepends(require_admin),
):
    query: dict = {}
    if status:
        query["status"] = status
    if user_id:
        query["user_id"] = user_id
    cursor = db.guias.find(query, {"_id": 0}).sort("data_vencimento", -1).limit(min(int(limit or 200), 500))
    items = await cursor.to_list(length=500)

    user_ids = list({i.get("user_id") for i in items if i.get("user_id")})
    empresa_ids = list({i.get("empresa_id") for i in items if i.get("empresa_id")})
    owners, empresas = {}, {}
    if user_ids:
        async for u in db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}):
            owners[u["user_id"]] = u
    if empresa_ids:
        async for e in db.empresas.find(
            {"empresa_id": {"$in": empresa_ids}},
            {"_id": 0, "empresa_id": 1, "razao_social": 1, "nome_fantasia": 1, "cnpj": 1},
        ):
            empresas[e["empresa_id"]] = e
    for i in items:
        o = owners.get(i.get("user_id")) or {}
        e = empresas.get(i.get("empresa_id")) or {}
        i["owner_name"] = o.get("name")
        i["owner_email"] = o.get("email")
        i["empresa_nome"] = e.get("nome_fantasia") or e.get("razao_social")
        i["empresa_cnpj"] = e.get("cnpj")
    return {"items": items, "total": len(items)}


@admin_router.get("/logs/whatsapp")
async def admin_logs_whatsapp(
    user_id: Optional[str] = None,
    sucesso: Optional[bool] = None,
    limit: int = 100,
    admin: dict = _AdminDepends(require_admin),
):
    query: dict = {"canal": "whatsapp"}
    if user_id:
        query["user_id"] = user_id
    if sucesso is not None:
        query["sucesso"] = bool(sucesso)
    cursor = db.notificacoes.find(query, {"_id": 0}).sort("created_at", -1).limit(min(int(limit or 100), 500))
    items = await cursor.to_list(length=500)

    # Resolver nomes dos contadores
    user_ids = list({i.get("user_id") for i in items if i.get("user_id")})
    owners = {}
    if user_ids:
        async for u in db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}):
            owners[u["user_id"]] = u
    for i in items:
        o = owners.get(i.get("user_id")) or {}
        i["owner_name"] = o.get("name")
        i["owner_email"] = o.get("email")
    return {"items": items, "total": len(items)}


@admin_router.get("/config")
async def admin_config_get(admin: dict = _AdminDepends(require_admin)):
    doc = await db.system_config.find_one({"_id": "global"}, {"_id": 0}) or {}
    apibrasil = bool(os.getenv("APIBRASIL_BEARER_TOKEN"))
    return {
        "maintenance_mode": bool(doc.get("maintenance_mode", False)),
        "maintenance_message": doc.get("maintenance_message", ""),
        "banner_message": doc.get("banner_message", ""),
        "banner_active": bool(doc.get("banner_active", False)),
        "apibrasil_configured": apibrasil,
        "admin_emails": sorted(list(_admin_emails())),
    }


class AdminConfigPatch(BaseModel):
    maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = None
    banner_message: Optional[str] = None
    banner_active: Optional[bool] = None


@admin_router.patch("/config")
async def admin_config_patch(
    body: AdminConfigPatch,
    admin: dict = _AdminDepends(require_admin),
):
    update: dict = {}
    for k in ("maintenance_mode", "maintenance_message", "banner_message", "banner_active"):
        v = getattr(body, k)
        if v is not None:
            update[k] = v
    if not update:
        raise HTTPException(status_code=400, detail="Nada para atualizar")
    update["updated_at"] = datetime.now(timezone.utc)
    update["updated_by"] = admin.get("user_id")
    await db.system_config.update_one({"_id": "global"}, {"$set": update}, upsert=True)
    await registrar_log(admin["user_id"], "admin_config_update", "config", "global", {"changes": update})
    return {"ok": True}


# ============ ROOT & HEALTH CHECK ============

@api_router.get("/")
async def root():
    return {
        "message": "API Guia Fiscal",
        "version": "1.0.0",
        "status": "online"
    }

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}


# Include the router in the main app
app.include_router(api_router)
app.include_router(admin_router)
app.include_router(build_communication_router(get_current_user, is_admin_email=_is_admin_email))

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_allow_origins(),
    allow_origin_regex=_cors_allow_origin_regex(),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_indexes():
    try:
        await db.empresas.create_index(
            [("portal_token", 1)],
            unique=True,
            partialFilterExpression={"portal_token": {"$type": "string"}},
        )
    except Exception as e:
        logger.warning("create_index portal_token: %s", e)
    try:
        center = init_center(db)
        await center.startup()
        logger.info("CommunicationCenter iniciado")
    except Exception as e:
        logger.exception("Falha ao iniciar CommunicationCenter: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    try:
        center = get_center()
        await center.shutdown()
    except Exception:
        pass
    client.close()
