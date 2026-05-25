"""

Análise em lote pós-OCR: match de empresa, duplicidade e agrupamento.

Extração de CNPJ com validação e exclusão de falsos positivos (linha digitável).

"""

from __future__ import annotations



import hashlib

import logging

import re

import unicodedata

from collections import defaultdict

from datetime import datetime

from typing import Any, Optional



logger = logging.getLogger(__name__)



# Palavras genéricas que NÃO devem ser usadas para match de empresa (alto risco de falso positivo)

_STOPWORDS_EMPRESA = {

    "ltda", "me", "mei", "epp", "eireli", "sa", "ss", "cia", "comercio",

    "comercial", "servicos", "industria", "industrial", "transportes",

    "consultoria", "empresa", "grupo", "casa", "loja", "centro", "the",

    "and", "de", "do", "da", "dos", "das", "para", "por", "com", "sem",

    "ltd", "inc", "corp", "corporation",

}



# Palavras que indicam linha com CNPJ do contribuinte (guias DAS, DARF, GA, etc.)

_CNPJ_CONTEXT_KEYWORDS = (

    "cnpj",

    "cpf/cnpj",

    "cpf cnpj",

    "c.n.p.j",

    "contribuinte",

    "nome empresarial",

    "razao social",

    "razão social",

    "nome da empresa",

    "inscricao",

    "inscrição",

    "identificacao",

    "identificação",

)



# Linhas que são quase sempre linha digitável / código de barras (não usar CNPJ daqui)

_BARCODE_LINE_KEYWORDS = (

    "linha digit",

    "linha digitável",

    "linha digitavel",

    "codigo de barras",

    "código de barras",

    "representacao numerica",

    "representação numérica",

    "autenticacao mecanica",

    "autenticação mecânica",

    "ficha de compensacao",

    "ficha de compensação",

)





def limpar_cnpj(cnpj: Optional[str]) -> str:

    if not cnpj:

        return ""

    return re.sub(r"\D", "", cnpj)





def _normalizar_texto_busca(s: str) -> str:

    if not s:

        return ""

    nfkd = unicodedata.normalize("NFKD", s)

    ascii_only = nfkd.encode("ascii", "ignore").decode("ascii")

    return re.sub(r"[^a-z0-9 ]", " ", ascii_only.lower()).strip()


def _tokens_texto_busca(texto_norm: str) -> set[str]:
    tokens = [w for w in texto_norm.split() if len(w) >= 2]
    out = set(tokens)

    # "L J Equipamentos" costuma aparecer em guias/arquivos como "LJ EQUIP".
    for i in range(len(tokens) - 1):
        if len(tokens[i]) == 1 and len(tokens[i + 1]) == 1:
            out.add(tokens[i] + tokens[i + 1])

    return out


def _tokens_empresa_significativos(nome_norm: str) -> list[str]:
    raw = nome_norm.split()
    tokens: list[str] = []
    i = 0
    while i < len(raw):
        atual = raw[i]
        if (
            len(atual) == 1
            and i + 1 < len(raw)
            and len(raw[i + 1]) == 1
            and atual.isalpha()
            and raw[i + 1].isalpha()
        ):
            tokens.append(atual + raw[i + 1])
            i += 2
            continue
        if len(atual) >= 3 and atual not in _STOPWORDS_EMPRESA:
            tokens.append(atual)
        i += 1
    return tokens


def _token_empresa_no_texto(token: str, texto_tokens: set[str]) -> bool:
    if token in texto_tokens:
        return True

    # Permite abreviações comuns do OCR/arquivo, ex.: "equip" x "equipamentos".
    if len(token) < 4:
        return False
    for candidato in texto_tokens:
        if len(candidato) < 4:
            continue
        prefix_len = min(len(token), len(candidato))
        if prefix_len >= 4 and token[:prefix_len] == candidato[:prefix_len]:
            return True
    return False





def corrigir_digitos_ocr(fragmento: str) -> str:

    """Corrige letras comuns confundidas com dígitos em trechos numéricos."""

    mapa = {

        "O": "0",

        "o": "0",

        "Q": "0",

        "I": "1",

        "l": "1",

        "|": "1",

        "Z": "2",

        "S": "5",

        "s": "5",

        "B": "8",

        "G": "6",

        "T": "7",

    }

    out = []

    for ch in fragmento:

        if ch.isdigit():

            out.append(ch)

        elif ch in mapa:

            out.append(mapa[ch])

        else:

            out.append(ch)

    return "".join(out)





def validar_cnpj(cnpj: str) -> bool:

    """Valida dígitos verificadores do CNPJ (Receita Federal)."""

    c = limpar_cnpj(cnpj)

    if len(c) != 14:

        return False

    if c == c[0] * 14:

        return False

    if c in ("00000000000000", "11111111111111"):

        return False



    def dv(nums: str, pesos: list[int]) -> int:

        s = sum(int(n) * p for n, p in zip(nums, pesos))

        r = s % 11

        return 0 if r < 2 else 11 - r



    p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    if dv(c[:12], p1) != int(c[12]):

        return False

    if dv(c[:13], p2) != int(c[13]):

        return False

    return True





def _linha_e_linha_digitavel(linha: str) -> bool:

    low = linha.lower()

    if any(kw in low for kw in _BARCODE_LINE_KEYWORDS):

        return True

    digits = re.sub(r"\D", "", linha)

    # Linha com 44+ dígitos contínuos = linha digitável

    if len(digits) >= 44:

        return True

    # Alta densidade numérica em linha longa
    stripped = linha.strip()

    if len(stripped) >= 20:

        ratio = len(digits) / max(len(stripped), 1)

        if ratio > 0.75 and len(digits) >= 30:

            return True

    return False





def _candidato_em_codigo_barras(cnpj: str, codigo_barras: Optional[str]) -> bool:

    if not codigo_barras:

        return False

    bar = limpar_cnpj(codigo_barras)

    c = limpar_cnpj(cnpj)

    if not bar or len(c) != 14:

        return False

    return c in bar





def _registrar_candidato(

    candidatos: dict[str, int],

    bruto: str,

    score: int,

    *,

    codigo_barras: Optional[str] = None,

) -> None:

    limpo = limpar_cnpj(corrigir_digitos_ocr(bruto))

    if len(limpo) != 14:

        return

    if not validar_cnpj(limpo):

        return

    if _candidato_em_codigo_barras(limpo, codigo_barras):

        return

    candidatos[limpo] = max(candidatos.get(limpo, 0), score)





def extrair_cnpj_do_texto(texto: str, codigo_barras: Optional[str] = None) -> Optional[str]:

    """

    Extrai CNPJ do texto OCR priorizando contexto e validação.

    Não usa trechos da linha digitável nem substrings do código de barras.

    """

    if not texto or not str(texto).strip():

        return None



    candidatos: dict[str, int] = {}

    linhas = texto.splitlines()



    # 1) Formato mascarado XX.XXX.XXX/XXXX-XX (alta confiança)

    for m in re.finditer(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}", texto):

        _registrar_candidato(candidatos, m.group(0), 100, codigo_barras=codigo_barras)



    # 2) Após rótulo CNPJ / CPF/CNPJ na mesma linha ou na seguinte

    for i, linha in enumerate(linhas):

        if _linha_e_linha_digitavel(linha):

            continue

        for j in range(i, min(i + 2, len(linhas))):

            trecho = linhas[j]

            if _linha_e_linha_digitavel(trecho):

                continue

            for m in re.finditer(

                r"(?:cnpj|c\.?n\.?p\.?j\.?|cpf\s*/\s*cnpj)[\s:]*"

                r"(\d{2}\D?\d{3}\D?\d{3}\D?\d{4}\D?\d{2})",

                trecho,

                re.IGNORECASE,

            ):

                _registrar_candidato(candidatos, m.group(1), 98, codigo_barras=codigo_barras)



    # 3) Linhas com contexto de contribuinte / razão social

    for linha in linhas:

        if _linha_e_linha_digitavel(linha):

            continue

        low = linha.lower()

        if not any(kw in low for kw in _CNPJ_CONTEXT_KEYWORDS):

            continue

        # Mascarado na linha de contexto

        for m in re.finditer(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}", linha):

            _registrar_candidato(candidatos, m.group(0), 95, codigo_barras=codigo_barras)

        # 14 dígitos com separadores flexíveis (OCR)

        for m in re.finditer(

            r"(\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}[/\s.\-]?\d{4}[\s.\-]?\d{2})",

            linha,

        ):

            _registrar_candidato(candidatos, m.group(1), 92, codigo_barras=codigo_barras)



    # 4) Varredura em linhas que NÃO são linha digitável (somente CNPJ válido)

    for linha in linhas:

        if _linha_e_linha_digitavel(linha):

            continue

        digits_only = re.sub(r"\D", "", linha)

        if len(digits_only) < 14:

            continue

        # Evita linha que é claramente só código (muitos dígitos seguidos)

        if len(digits_only) >= 40:

            continue

        for m in re.finditer(r"\d{14}", digits_only):

            score = 70 if any(kw in linha.lower() for kw in _CNPJ_CONTEXT_KEYWORDS) else 55

            _registrar_candidato(candidatos, m.group(0), score, codigo_barras=codigo_barras)



    # 5) Último recurso: texto sem linhas de barcode, blocos de 14 dígitos válidos

    if not candidatos:

        texto_filtrado = []

        for linha in linhas:

            if not _linha_e_linha_digitavel(linha):

                texto_filtrado.append(linha)

        compacto = re.sub(r"\s", "", "\n".join(texto_filtrado))

        for m in re.finditer(r"\d{14}", compacto):

            _registrar_candidato(candidatos, m.group(0), 40, codigo_barras=codigo_barras)



    if not candidatos:

        return None



    melhor = max(candidatos.items(), key=lambda x: (x[1], x[0]))

    return melhor[0]





def extrair_cnpj_codigo_barras(codigo: Optional[str]) -> Optional[str]:

    """

    Descontinuado: linha digitável não contém CNPJ confiável em substring de 14 dígitos.

    Mantido por compatibilidade; sempre retorna None.

    """

    return None




def corrigir_ocr_digitos(texto: str) -> str:
    """Corrige erros comuns de OCR em sequências numéricas (alias antigo)."""
    correcoes = {
        "O": "0", "o": "0",
        "I": "1", "l": "1", "|": "1",
        "Z": "2",
        "S": "5", "s": "5",
        "B": "8",
        "G": "6",
        "T": "7",
    }
    out = []
    for ch in texto:
        if ch.isdigit():
            out.append(ch)
        elif ch in correcoes:
            out.append(correcoes[ch])
        else:
            out.append(ch)
    return "".join(out)


def validar_barcode_candidato(codigo: str) -> bool:
    """
    Valida se um candidato a código de barras é razoável.
    Evita falsos positivos de combinações de CNPJ + datas + valores.
    """
    if not codigo or len(codigo) < 44:
        return False
    if all(c == "0" for c in codigo):
        return False
    if codigo[0] == "8":
        return True
    try:
        bank_code = int(codigo[:3])
        if 1 <= bank_code <= 999:
            return True
    except ValueError:
        pass
    return True


def extrair_codigo_barras(texto: str) -> Optional[str]:
    """
    Extrai código de barras (linha digitável) de guias brasileiras.

    Formatos suportados:
    - Arrecadação (DAS, DARF, GPS, GA, ICMS, etc.): 48 dígitos
    - Boleto bancário: 47 dígitos
    - Código de barras numérico: 44 dígitos
    """
    if not texto:
        return None

    logger.info("=== INÍCIO EXTRAÇÃO CÓDIGO DE BARRAS ===")

    texto_flat = texto.replace("\n", " ").replace("\r", " ")
    linhas = texto.split("\n")

    keywords_barcode = [
        "linha digit",
        "codigo de barras",
        "código de barras",
        "representação numérica",
        "representacao numerica",
        "linha digitável",
        "linha digitavel",
        "autenticação mecânica",
        "autenticacao mecanica",
        "ficha de compensação",
        "ficha de compensacao",
    ]

    for i, linha in enumerate(linhas):
        linha_lower = linha.lower().strip()
        if any(kw in linha_lower for kw in keywords_barcode):
            for j in range(i, min(len(linhas), i + 5)):
                linha_clean = re.sub(r"[\s.\-–—]", "", linhas[j])
                candidato = re.sub(r"[^0-9]", "", linha_clean)
                if 44 <= len(candidato) <= 60:
                    codigo = candidato[:48] if len(candidato) >= 48 else candidato
                    if validar_barcode_candidato(codigo):
                        logger.info(
                            f"Código de barras (keyword '{linha_lower[:30]}', linha {j}): {codigo}"
                        )
                        return codigo
            combined_digits = ""
            for j in range(i + 1, min(len(linhas), i + 5)):
                linha_clean = re.sub(r"[\s.\-–—]", "", linhas[j])
                combined_digits += re.sub(r"[^0-9]", "", linha_clean)
            if 44 <= len(combined_digits) <= 60:
                codigo = (
                    combined_digits[:48] if len(combined_digits) >= 48 else combined_digits
                )
                if validar_barcode_candidato(codigo):
                    logger.info(f"Código de barras (keyword combinado): {codigo}")
                    return codigo

    for i, linha in enumerate(linhas):
        linha_limpa = re.sub(r"[\s.\-–—]", "", linha)
        if 44 <= len(re.sub(r"[^0-9]", "", linha_limpa)) <= 60:
            digits = re.sub(r"[^0-9]", "", linha_limpa)
            if validar_barcode_candidato(digits[:48]):
                codigo = digits[:48] if len(digits) >= 48 else digits
                logger.info(f"Código de barras (linha única {i}): {codigo}")
                return codigo

    arrecadacao_match = re.search(
        r"(\d[\d.\-]{10,14}\s+\d[\d.\-]{10,14}\s+\d[\d.\-]{10,14}\s+\d[\d.\-]{10,14})",
        texto_flat,
    )
    if arrecadacao_match:
        codigo = re.sub(r"[^0-9]", "", arrecadacao_match.group(1))
        if 44 <= len(codigo) <= 60:
            codigo = codigo[:48] if len(codigo) >= 48 else codigo
            if validar_barcode_candidato(codigo):
                logger.info(f"Código de barras (4 blocos arrecadação): {codigo}")
                return codigo

    hifen_match = re.search(
        r"(\d{11,12}[\s.\-]*\d[\s]+\d{11,12}[\s.\-]*\d[\s]+\d{11,12}[\s.\-]*\d[\s]+\d{11,12}[\s.\-]*\d)",
        texto_flat,
    )
    if hifen_match:
        codigo = re.sub(r"[^0-9]", "", hifen_match.group(1))
        if 44 <= len(codigo) <= 60:
            codigo = codigo[:48] if len(codigo) >= 48 else codigo
            if validar_barcode_candidato(codigo):
                logger.info(f"Código de barras (blocos com hífens): {codigo}")
                return codigo

    boleto_pattern = re.search(
        r"(\d{5}[\s.]*\d{5}[\s.]*\d{5}[\s.]*\d{6}[\s.]*\d{5}[\s.]*\d{6}[\s.]*\d[\s.]*\d{14})",
        texto_flat,
    )
    if boleto_pattern:
        codigo = re.sub(r"[^0-9]", "", boleto_pattern.group(1))
        if len(codigo) >= 44:
            logger.info(f"Código de barras (boleto): {codigo}")
            return codigo

    linhas_numericas: list[tuple[int, str, float]] = []
    for i, linha in enumerate(linhas):
        linha_strip = linha.strip()
        if len(linha_strip) < 10:
            continue
        digitos = re.sub(r"[^0-9]", "", linha_strip)
        ratio = len(digitos) / len(linha_strip) if linha_strip else 0
        if ratio > 0.85 and len(digitos) >= 10:
            linhas_numericas.append((i, digitos, ratio))

    if linhas_numericas:
        for start in range(len(linhas_numericas)):
            combined = linhas_numericas[start][1]
            if 44 <= len(combined) <= 60:
                codigo = combined[:48] if len(combined) >= 48 else combined
                if validar_barcode_candidato(codigo):
                    logger.info(f"Código de barras (linha numérica): {codigo}")
                    return codigo
            for end in range(start + 1, len(linhas_numericas)):
                if linhas_numericas[end][0] - linhas_numericas[start][0] > 3:
                    break
                combined += linhas_numericas[end][1]
                if 44 <= len(combined) <= 60:
                    codigo = combined[:48] if len(combined) >= 48 else combined
                    if validar_barcode_candidato(codigo):
                        logger.info(f"Código de barras (linhas combinadas): {codigo}")
                        return codigo
                elif len(combined) > 60:
                    break

    for i, linha in enumerate(linhas):
        linha_limpa = re.sub(r"[\.\-–—]", "", linha)
        blocos_linha = re.findall(r"\d{10,}", linha_limpa)
        if not blocos_linha:
            continue
        combined = "".join(blocos_linha)
        if 44 <= len(combined) <= 60:
            codigo = combined[:48] if len(combined) >= 48 else combined
            if validar_barcode_candidato(codigo):
                logger.info(f"Código de barras (blocos linha {i}): {codigo}")
                return codigo
        if i + 1 < len(linhas):
            next_limpa = re.sub(r"[\.\-–—]", "", linhas[i + 1])
            blocos_next = re.findall(r"\d{10,}", next_limpa)
            combined2 = combined + "".join(blocos_next)
            if 44 <= len(combined2) <= 60:
                codigo = combined2[:48] if len(combined2) >= 48 else combined2
                if validar_barcode_candidato(codigo):
                    logger.info(
                        f"Código de barras (blocos linhas {i}-{i + 1}): {codigo}"
                    )
                    return codigo

    logger.info("Código de barras NÃO encontrado")
    return None


def extrair_qr_code_pix(texto: str) -> Optional[str]:
    """Extrai código PIX (copia e cola) do texto OCR, quando estiver impresso como texto."""
    if not texto:
        return None

    logger.info("=== INÍCIO EXTRAÇÃO PIX ===")

    texto_sem_espacos = re.sub(r"\s", "", texto)

    emv_match = re.search(
        r"(0002\d{2}26\d{2}[\dA-Za-z\.\-\/:@]+6304[A-Fa-f0-9]{4})",
        texto_sem_espacos,
    )
    if emv_match:
        pix = emv_match.group(1)
        logger.info(f"PIX encontrado (EMV): {pix[:60]}...")
        return pix

    emv_match2 = re.search(r"(00020126\S{50,})", texto_sem_espacos)
    if emv_match2:
        pix = emv_match2.group(1)
        logger.info(f"PIX encontrado (EMV flex): {pix[:60]}...")
        return pix

    linhas = texto.split("\n")
    pix_keywords = [
        "pix",
        "copia e cola",
        "cópia e cola",
        "qr code pix",
        "chave pix",
        "pix copia",
    ]
    for i, linha in enumerate(linhas):
        linha_lower = linha.lower().strip()
        if any(kw in linha_lower for kw in pix_keywords):
            for j in range(i, min(len(linhas), i + 5)):
                linha_candidata = linhas[j].strip()
                clean = re.sub(r"\s", "", linha_candidata)
                if len(clean) > 50 and re.match(r"^[A-Za-z0-9\.\-\/:@\*]+$", clean):
                    logger.info(f"PIX encontrado (keyword, linha {j}): {clean[:60]}...")
                    return clean

    for linha in linhas:
        clean = re.sub(r"\s", "", linha)
        if "0002" in clean and len(clean) > 80:
            start = clean.index("0002")
            pix_candidate = clean[start:]
            if len(pix_candidate) > 50:
                logger.info(
                    f"PIX encontrado (string longa com 0002): {pix_candidate[:60]}..."
                )
                return pix_candidate

    logger.info("PIX NÃO encontrado no texto")
    return None


_MESES_PT = {
    "janeiro": "01",
    "fevereiro": "02",
    "março": "03",
    "marco": "03",
    "abril": "04",
    "maio": "05",
    "junho": "06",
    "julho": "07",
    "agosto": "08",
    "setembro": "09",
    "outubro": "10",
    "novembro": "11",
    "dezembro": "12",
}


def extrair_dados_guia(texto: str) -> dict:
    """Extrai valor, data, código de barras, competência, PIX, tipo e CNPJ do texto OCR."""
    resultado: dict = {
        "valor": None,
        "data_vencimento": None,
        "codigo_barras": None,
        "qr_code_pix": None,
        "competencia": None,
        "tipo_documento": None,
        "descricao_sugerida": None,
        "cnpj": None,
    }

    if not texto:
        return resultado

    logger.info(f"=== OCR TEXTO COMPLETO ({len(texto)} chars) ===")
    logger.info(texto[:2000])
    if len(texto) > 2000:
        logger.info(f"... (mais {len(texto) - 2000} chars)")
    logger.info("=== FIM TEXTO OCR ===")

    texto_lower = texto.lower()

    tipo_patterns = [
        (r"guia\s+de\s+arrecada[çc][ãa]o\s*[-–]\s*ga", "GA"),
        (r"guia\s+de\s+arrecada[çc][ãa]o", "GA"),
        (r"\bga\b.*arrecada[çc][ãa]o", "GA"),
        (r"arrecada[çc][ãa]o\s*[-–]\s*ga\b", "GA"),
        (r"receita\s+do\s+estado", "GA"),
        (r"secretaria\s+(?:da|de)\s+fazenda\s+(?:do\s+)?estado", "GA"),
        (r"gare", "GARE"),
        (r"\bdae\b", "DAE"),
        (r"\bgru\b", "GRU"),
        (r"documento\s+de\s+arrecada[çc][ãa]o\s+do\s+simples\s+nacional", "DAS"),
        (r"\bdas\b.*simples\s+nacional", "DAS"),
        (r"simples\s+nacional.*\bdas\b", "DAS"),
        (r"\bdarf\b", "DARF"),
        (r"guia\s+da\s+previd[êe]ncia\s+social", "GPS"),
        (r"\bgps\b", "GPS"),
        (r"\bfgts\b", "FGTS"),
        (r"\binss\b.*guia", "INSS"),
        (r"\biss(?:qn)?\b", "ISS"),
        (r"\bicms\b", "ICMS"),
        (r"simples\s+nacional", "DAS"),
    ]
    for pattern, tipo in tipo_patterns:
        if re.search(pattern, texto_lower):
            resultado["tipo_documento"] = tipo
            logger.info(f"Tipo documento identificado: {tipo} (padrão: {pattern})")
            break

    for mes_nome in _MESES_PT.keys():
        pattern = rf"({mes_nome})[/-](\d{{4}})"
        match = re.search(pattern, texto, re.IGNORECASE)
        if match:
            mes_encontrado = match.group(1).capitalize()
            ano = match.group(2)
            resultado["competencia"] = f"{mes_encontrado}/{ano}"
            logger.info(f"Competência encontrada: {resultado['competencia']}")
            break

    if not resultado["competencia"]:
        comp_match = re.search(
            r"(?:compet[êe]ncia|per[ií]odo|refer[êe]ncia|apura[çc][ãa]o)[\s:]*(\d{2}[/-]\d{4})",
            texto,
            re.IGNORECASE,
        )
        if comp_match:
            resultado["competencia"] = comp_match.group(1).replace("-", "/")
            logger.info(f"Competência (numérica): {resultado['competencia']}")

    if not resultado["competencia"]:
        pa_match = re.search(r"(?:PA|P\.A\.)[\s:]*(\d{2}[/-]\d{4})", texto, re.IGNORECASE)
        if pa_match:
            resultado["competencia"] = pa_match.group(1).replace("-", "/")
            logger.info(f"Competência (PA): {resultado['competencia']}")

    tipo = resultado["tipo_documento"] or "Guia"
    comp = resultado["competencia"]
    resultado["descricao_sugerida"] = f"{tipo} - {comp}" if comp else tipo

    valor_regex = r"(\d{1,3}(?:\.\d{3})*,\d{2})"
    todos_valores: list[tuple[float, str, int]] = []
    for match in re.finditer(valor_regex, texto):
        valor_str = match.group(1)
        valor_clean = valor_str.replace(".", "").replace(",", ".")
        try:
            valor_float = float(valor_clean)
            if valor_float > 0:
                todos_valores.append((valor_float, valor_str, match.start()))
        except ValueError:
            pass

    if todos_valores:
        valor_total_patterns = [
            r"(?:valor\s*total|total\s*do\s*(?:documento|das|darf)|valor\s*do\s*(?:das|documento))[\s:R$]*(\d{1,3}(?:\.\d{3})*,\d{2})",
            r"(?:valor\s*a\s*(?:pagar|recolher))[\s:R$]*(\d{1,3}(?:\.\d{3})*,\d{2})",
            r"(?:valor\s*principal)[\s:R$]*(\d{1,3}(?:\.\d{3})*,\d{2})",
            r"Valor[\s:]+R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})",
            r"Pagar\s*(?:até|ate)[\s:]*\d{2}[/-]\d{2}[/-]\d{4}\s*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})",
        ]
        valor_encontrado = False
        for pattern in valor_total_patterns:
            match = re.search(pattern, texto, re.IGNORECASE)
            if match:
                valor_str = match.group(1)
                valor_clean = valor_str.replace(".", "").replace(",", ".")
                try:
                    resultado["valor"] = float(valor_clean)
                    valor_encontrado = True
                    logger.info(
                        f"Valor encontrado (padrão específico): {resultado['valor']}"
                    )
                    break
                except ValueError:
                    pass
        if not valor_encontrado and todos_valores:
            maior_valor = max(todos_valores, key=lambda x: x[0])
            resultado["valor"] = maior_valor[0]
            logger.info(
                f"Valor encontrado (maior): {resultado['valor']} (de {len(todos_valores)} valores)"
            )

    data_patterns = [
        r"(?:vencimento|venc\.?)[\s:]*(\d{2}[/-]\d{2}[/-]\d{4})",
        r"(?:pagar\s*(?:até|ate))[\s:]*(\d{2}[/-]\d{2}[/-]\d{4})",
        r"(?:data\s*(?:de\s*)?limite)[\s:]*(\d{2}[/-]\d{2}[/-]\d{4})",
        r"(\d{2}[/-]\d{2}[/-]\d{4})",
    ]
    for pattern in data_patterns:
        match = re.search(pattern, texto, re.IGNORECASE)
        if match:
            data_str = match.group(1).replace("-", "/")
            resultado["data_vencimento"] = data_str
            logger.info(f"Data vencimento: {data_str}")
            break

    resultado["codigo_barras"] = extrair_codigo_barras(texto)
    resultado["qr_code_pix"] = extrair_qr_code_pix(texto)

    resultado["cnpj"] = extrair_cnpj_do_texto(
        texto, codigo_barras=resultado.get("codigo_barras")
    )
    if resultado["cnpj"]:
        logger.info(f"CNPJ extraído: {resultado['cnpj']}")

    logger.info(
        f"=== RESULTADO FINAL: valor={resultado['valor']}, data={resultado['data_vencimento']}, "
        f"barcode={'SIM' if resultado['codigo_barras'] else 'NÃO'}, "
        f"pix={'SIM' if resultado['qr_code_pix'] else 'NÃO'}, "
        f"tipo={resultado['tipo_documento']}, comp={resultado['competencia']}, "
        f"cnpj={resultado.get('cnpj')} ==="
    )
    return resultado





def normalizar_data_iso(data: Optional[str]) -> Optional[str]:

    if not data or not str(data).strip():

        return None

    raw = str(data).strip()

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):

        try:

            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")

        except ValueError:

            continue

    return None





def hash_arquivo_base64(data_url: str) -> str:

    payload = data_url.split(",", 1)[-1] if "," in data_url else data_url

    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]





def match_empresa(

    empresas: list[dict],

    cnpj: Optional[str],

    texto: str = "",

) -> tuple[Optional[dict], str]:

    """

    Retorna (empresa, confianca):

    - "alta": CNPJ válido bate com empresa cadastrada

    - "media": nome significativo da empresa aparece no texto OCR

    - "nenhuma": deixa em branco para o usuário escolher manualmente



    Política: SEM CNPJ válido, só vincula se houver match de nome MUITO específico

    (nome inteiro presente no texto e com pelo menos 5 caracteres, OU múltiplos

    tokens distintivos batendo). Caso contrário, retorna None — usuário escolhe.

    """

    cnpj_limpo = limpar_cnpj(cnpj)

    if cnpj_limpo and validar_cnpj(cnpj_limpo):

        for emp in empresas:

            if limpar_cnpj(emp.get("cnpj")) == cnpj_limpo:

                logger.info(

                    f"match_empresa: CNPJ {cnpj_limpo} bateu com empresa "

                    f"{emp.get('empresa_id')} ({emp.get('nome_fantasia') or emp.get('razao_social')})"

                )

                return emp, "alta"

        logger.info(

            f"match_empresa: CNPJ {cnpj_limpo} extraído mas não encontrado entre "

            f"{len(empresas)} empresas cadastradas"

        )



    texto_norm = _normalizar_texto_busca(texto)

    if not texto_norm:

        return None, "nenhuma"

    texto_tokens = _tokens_texto_busca(texto_norm)



    melhor: Optional[dict] = None

    melhor_score = 0.0

    melhor_motivo = ""



    for emp in empresas:

        emp_score = 0.0

        emp_motivo = ""

        for campo in (emp.get("nome_fantasia"), emp.get("razao_social")):

            if not campo:

                continue

            nome_norm = _normalizar_texto_busca(campo)

            if not nome_norm or len(nome_norm) < 5:

                continue



            # Nome completo presente no texto: forte (mas não retornar logo)

            if nome_norm in texto_norm and len(nome_norm) >= 8:

                if 1.0 > emp_score:

                    emp_score = 1.0

                    emp_motivo = f"nome '{nome_norm}' encontrado no texto"

                continue



            tokens_signif = _tokens_empresa_significativos(nome_norm)

            if len(tokens_signif) < 2:

                continue

            hits = sum(1 for t in tokens_signif if _token_empresa_no_texto(t, texto_tokens))

            score = hits / len(tokens_signif)

            # Exige pelo menos 2 tokens distintivos batendo E score >= 0.75

            if hits >= 2 and score >= 0.75 and score > emp_score:

                emp_score = score

                emp_motivo = (

                    f"{hits}/{len(tokens_signif)} tokens distintivos de "

                    f"'{nome_norm}' encontrados no texto"

                )



        if emp_score > melhor_score:

            melhor_score = emp_score

            melhor = emp

            melhor_motivo = emp_motivo



    if melhor and melhor_score >= 0.75:

        conf = "alta" if melhor_score >= 0.95 else "media"

        logger.info(

            f"match_empresa: empresa {melhor.get('empresa_id')} "

            f"({melhor.get('nome_fantasia') or melhor.get('razao_social')}) "

            f"vinculada por NOME (conf={conf}, score={melhor_score:.2f}): {melhor_motivo}"

        )

        return melhor, conf

    return None, "nenhuma"





def empresa_por_guia_existente(

    codigo_barras: Optional[str],

    guias_db: list[dict],

    empresas_por_id: dict[str, dict],

) -> tuple[Optional[dict], Optional[str]]:

    """Se o código de barras já existe, retorna empresa da guia cadastrada."""

    if not codigo_barras or len(re.sub(r"\D", "", codigo_barras)) < 44:

        return None, None

    cod = re.sub(r"\D", "", codigo_barras)

    for g in guias_db:

        gc = re.sub(r"\D", "", g.get("codigo_barras") or "")

        if gc and gc == cod:

            emp_id = g.get("empresa_id")

            if emp_id and emp_id in empresas_por_id:

                return empresas_por_id[emp_id], g.get("guia_id")

    return None, None





def _fingerprint_guia(

    empresa_id: str,

    tipo: str,

    valor: Optional[float],

    data_venc: Optional[str],

    codigo_barras: Optional[str],

    competencia: Optional[str],

) -> str:

    parts = [

        empresa_id or "",

        (tipo or "").upper(),

        f"{valor:.2f}" if valor is not None else "",

        data_venc or "",

        (codigo_barras or "")[:48],

        competencia or "",

    ]

    return "|".join(parts)





def detectar_duplicidade(

    item: dict,

    guias_db: list[dict],

    itens_lote: list[dict],

) -> list[str]:

    """Retorna lista de motivos de alerta de duplicidade."""

    alertas: list[str] = []

    emp_id = item.get("empresa_id")

    tipo = item.get("tipo") or item.get("tipo_documento") or "OUTROS"

    valor = item.get("valor")

    data_venc = normalizar_data_iso(item.get("data_vencimento"))

    codigo = item.get("codigo_barras")

    comp = item.get("competencia")

    file_hash = item.get("file_hash")



    if file_hash:

        mesmos = sorted(

            [o for o in itens_lote if o.get("file_hash") == file_hash],

            key=lambda x: x.get("temp_id") or "",

        )

        if len(mesmos) > 1 and mesmos[0].get("temp_id") != item.get("temp_id"):

            alertas.append("Arquivo duplicado no mesmo lote.")



    if item.get("ja_cadastrada"):

        alertas.append("Guia já importada antes (mesmo código de barras).")



    fp = _fingerprint_guia(emp_id or "", tipo, valor, data_venc, codigo, comp)



    for g in guias_db:

        if emp_id and g.get("empresa_id") != emp_id:

            continue

        gfp = _fingerprint_guia(

            g.get("empresa_id", ""),

            g.get("tipo", ""),

            float(g.get("valor") or 0),

            g.get("data_vencimento"),

            g.get("codigo_barras"),

            g.get("competencia"),

        )

        if fp and gfp == fp and not item.get("ja_cadastrada"):

            alertas.append("Possível guia duplicada (valor, vencimento e tipo iguais).")

            break



    for other in itens_lote:

        if other.get("temp_id") == item.get("temp_id"):

            continue

        if not emp_id or other.get("empresa_id") != emp_id:

            continue

        ofp = _fingerprint_guia(

            other.get("empresa_id", ""),

            other.get("tipo") or other.get("tipo_documento") or "",

            other.get("valor"),

            normalizar_data_iso(other.get("data_vencimento")),

            other.get("codigo_barras"),

            other.get("competencia"),

        )

        if fp and ofp == fp and other.get("temp_id") != item.get("temp_id"):

            alertas.append("Repetida neste lote (mesmos dados).")

            break



    return list(dict.fromkeys(alertas))





def agrupar_por_empresa(itens: list[dict]) -> list[dict]:

    grupos: dict[str, list[dict]] = defaultdict(list)

    for it in itens:

        key = it.get("empresa_id") or "_sem_empresa"

        grupos[key].append(it)



    saida = []

    for emp_id, lista in grupos.items():

        lista_sorted = sorted(

            lista,

            key=lambda x: (

                x.get("competencia") or "",

                normalizar_data_iso(x.get("data_vencimento")) or "",

            ),

        )

        nome = lista_sorted[0].get("empresa_nome") if lista_sorted else "Sem empresa"

        saida.append(

            {

                "empresa_id": None if emp_id == "_sem_empresa" else emp_id,

                "empresa_nome": nome or "Identificar empresa",

                "quantidade": len(lista_sorted),

                "itens": [x.get("temp_id") for x in lista_sorted],

            }

        )

    saida.sort(key=lambda g: (-g["quantidade"], g.get("empresa_nome") or ""))

    return saida





def analisar_itens_lote(

    itens: list[dict],

    empresas: list[dict],

    guias_db: list[dict],

) -> dict[str, Any]:

    empresas_por_id = {e["empresa_id"]: e for e in empresas}

    hashes_vistos: set[str] = set()

    processados: list[dict] = []



    for raw in itens:

        item = dict(raw)

        texto = item.get("texto_completo") or ""

        codigo = item.get("codigo_barras")



        cnpj = item.get("cnpj") or extrair_cnpj_do_texto(texto, codigo_barras=codigo)

        item["cnpj"] = cnpj

        item["cnpj_exibicao"] = (

            f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}" if cnpj and len(cnpj) == 14 else None

        )



        barcode_digits = re.sub(r"\D", "", codigo or "")

        logger.info(

            "analisar_itens_lote: arquivo '%s' cnpj_detectado=%s barcode_digits=%d",

            item.get("filename"), cnpj, len(barcode_digits),

        )

        # Match heurístico por nome usa SOMENTE o texto OCR (não o filename),
        # pois nomes de arquivo são controlados pelo usuário e podem causar
        # falso positivo em empresas com nomes curtos. Sem texto OCR suficiente,
        # exigimos CNPJ válido (match_empresa retorna None em caso contrário).
        texto_match = texto if texto and len(texto.strip()) >= 50 else ""
        emp, conf = match_empresa(empresas, cnpj, texto_match)

        item["ja_cadastrada"] = False

        item["guia_existente_id"] = None



        if not emp and codigo:

            emp_bar, guia_id = empresa_por_guia_existente(codigo, guias_db, empresas_por_id)

            if emp_bar:

                emp = emp_bar

                conf = "alta"

                item["ja_cadastrada"] = True

                item["guia_existente_id"] = guia_id



        if emp:

            item["empresa_id"] = emp["empresa_id"]

            item["empresa_nome"] = emp.get("nome_fantasia") or emp.get("razao_social")

            item["match_confianca"] = conf

        else:

            item["empresa_id"] = item.get("empresa_id")

            item["empresa_nome"] = item.get("empresa_nome")

            item["match_confianca"] = conf



        tipo = (item.get("tipo_documento") or item.get("tipo") or "OUTROS").upper()

        if tipo not in (

            "GA",

            "DAS",

            "DARF",

            "ICMS",

            "ISS",

            "INSS",

            "FGTS",

            "GPS",

            "GRU",

            "GARE",

            "DAE",

        ):

            tipo = "OUTROS" if tipo == "OUTROS" else tipo[:20]

        item["tipo"] = tipo

        item["descricao"] = item.get("descricao_sugerida") or (

            f"{tipo} - {item['competencia']}" if item.get("competencia") else tipo

        )

        item["data_vencimento_iso"] = normalizar_data_iso(item.get("data_vencimento"))



        fh = item.get("file_hash")

        if fh and fh in hashes_vistos:

            item["arquivo_repetido_lote"] = True

        elif fh:

            hashes_vistos.add(fh)

            item["arquivo_repetido_lote"] = False



        item["alertas_duplicidade"] = detectar_duplicidade(item, guias_db, itens)

        item["tem_duplicidade"] = len(item["alertas_duplicidade"]) > 0

        item["pronto"] = bool(

            item.get("empresa_id")

            and item.get("valor")

            and item.get("data_vencimento_iso")

        )

        processados.append(item)



    grupos = agrupar_por_empresa(processados)

    return {

        "itens": processados,

        "grupos": grupos,

        "resumo": {

            "total": len(processados),

            "prontos": sum(1 for i in processados if i.get("pronto")),

            "duplicatas": sum(1 for i in processados if i.get("tem_duplicidade")),

            "sem_empresa": sum(1 for i in processados if not i.get("empresa_id")),

            "ja_cadastradas": sum(1 for i in processados if i.get("ja_cadastrada")),

        },

    }


