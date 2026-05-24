"""Remove definições duplicadas em server.py que agora vivem em ocr_lote.py."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "backend" / "server.py"

START = "def _DEPRECATED_corrigir_ocr_digitos(texto: str) -> str:"
END_NEEDLE = '                f"cnpj={resultado.get(\'cnpj\')} ===")\n    \n    return resultado\n'


def main() -> None:
    src = SERVER.read_text(encoding="utf-8")

    start_idx = src.find(START)
    if start_idx == -1:
        raise SystemExit("Marcador START não encontrado")

    end_idx = src.find(END_NEEDLE, start_idx)
    if end_idx == -1:
        raise SystemExit("Marcador END não encontrado")

    end_full = end_idx + len(END_NEEDLE)

    new_src = (
        src[:start_idx]
        + "# === Funções de extração agora vivem em ocr_lote.py ===\n"
        + "# (corrigir_ocr_digitos, validar_barcode_candidato, extrair_codigo_barras,\n"
        + "#  extrair_qr_code_pix, extrair_dados_guia)\n\n"
        + src[end_full:]
    )

    SERVER.write_text(new_src, encoding="utf-8")
    print(f"Removido {end_full - start_idx} caracteres ({len(src)} -> {len(new_src)})")


if __name__ == "__main__":
    main()
