"""URL do portal do cliente nas mensagens de WhatsApp.

O token usa caracteres URL-safe (`_` e `-`). No WhatsApp, `_texto_` vira itálico
e quebra o link se a URL ficar no meio de markdown. Por isso a URL vai sozinha
numa linha, sem * ou _.
"""

from __future__ import annotations

import os

DEFAULT_PORTAL_BASE = "https://guiacontrol-app.vercel.app"


def portal_base_url() -> str:
    for env_name in ("PUBLIC_CLIENT_BASE_URL", "WEB_APP_URL", "EXPO_PUBLIC_WEB_APP_URL"):
        val = (os.getenv(env_name) or "").strip().rstrip("/")
        if val:
            return val
    return DEFAULT_PORTAL_BASE


def portal_cliente_url(token: str, base: str | None = None) -> str:
    tok = (token or "").strip()
    if not tok:
        return ""
    root = (base or portal_base_url()).rstrip("/")
    if not root:
        return ""
    return f"{root}/cliente/{tok}"


def portal_link_block(link: str) -> str:
    url = (link or "").strip()
    if not url:
        return ""
    return (
        "\n\nAbra seu painel (toque no link):\n"
        f"{url}\n"
        "Nele você vê a guia, paga (PIX ou boleto) e pode marcar como paga ou anexar comprovante."
    )


def ensure_portal_link_in_message(message: str, link: str, link_block: str = "") -> str:
    """Garante que o URL do painel esteja no texto enviado no WhatsApp."""
    text = (message or "").rstrip()
    url = (link or "").strip()
    if not url:
        return text
    if url in text:
        return text
    block = (link_block or "").strip() or portal_link_block(url).strip()
    if not block:
        return text
    return f"{text}\n\n{block}".rstrip()
