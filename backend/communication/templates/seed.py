"""Seed de templates reutilizáveis."""

from __future__ import annotations

from communication.domain import CommunicationEventType
from communication.repository import TemplatesRepository

SEED_TEMPLATES = [
    {
        "id": "tpl_due_7_a",
        "nome": "Vence em 7 dias A",
        "categoria": "lembrete",
        "ativo": True,
        "idioma": "pt-BR",
        "corpo": (
            "*GuiaControl — faltam 7 dias*\n\n"
            "Ola {{nome}}! Faltam *7 dias* para o vencimento da guia *{{competencia}}* "
            "({{empresa}}) no valor de *{{valor}}* (vencimento {{vencimento}})."
            "{{link_block}}"
        ),
        "variaveis": ["nome", "empresa", "competencia", "valor", "vencimento", "link_block"],
        "botoes": [],
        "event_types": [CommunicationEventType.GUIDE_DUE_IN_7_DAYS.value],
    },
    {
        "id": "tpl_due_7_b",
        "nome": "Vence em 7 dias B",
        "categoria": "lembrete",
        "ativo": True,
        "idioma": "pt-BR",
        "corpo": (
            "*Lembrete GuiaControl*\n\n"
            "{{nome}}, a guia *{{competencia}}* de {{empresa}} (*{{valor}}*) vence em 7 dias "
            "({{vencimento}}). Organize o pagamento com antecedencia.{{link_block}}"
        ),
        "variaveis": ["nome", "empresa", "competencia", "valor", "vencimento", "link_block"],
        "botoes": [],
        "event_types": [CommunicationEventType.GUIDE_DUE_IN_7_DAYS.value],
    },
    {
        "id": "tpl_due_3_a",
        "nome": "Vence em 3 dias A",
        "categoria": "lembrete",
        "ativo": True,
        "idioma": "pt-BR",
        "corpo": (
            "*GuiaControl — faltam 3 dias*\n\n"
            "Faltam *3 dias* para vencer a guia *{{competencia}}* ({{empresa}}) — *{{valor}}* "
            "(vencimento {{vencimento}}).{{link_block}}"
        ),
        "variaveis": ["nome", "empresa", "competencia", "valor", "vencimento", "link_block"],
        "botoes": [],
        "event_types": [CommunicationEventType.GUIDE_DUE_IN_3_DAYS.value],
    },
    {
        "id": "tpl_due_today_a",
        "nome": "Vence hoje A",
        "categoria": "lembrete",
        "ativo": True,
        "idioma": "pt-BR",
        "corpo": (
            "*GuiaControl — vence hoje*\n\n"
            "A guia *{{competencia}}* ({{empresa}}) no valor de *{{valor}}* *vence hoje* "
            "({{vencimento}}).{{link_block}}"
        ),
        "variaveis": ["nome", "empresa", "competencia", "valor", "vencimento", "link_block"],
        "botoes": [],
        "event_types": [CommunicationEventType.GUIDE_DUE_TODAY.value],
    },
    {
        "id": "tpl_overdue_a",
        "nome": "Em atraso A",
        "categoria": "cobranca",
        "ativo": True,
        "idioma": "pt-BR",
        "corpo": (
            "*GuiaControl — guia em atraso*\n\n"
            "A guia *{{competencia}}* ({{empresa}}) de *{{valor}}* esta *em atraso* "
            "(vencimento {{vencimento}}). Regularize o pagamento.{{link_block}}"
        ),
        "variaveis": ["nome", "empresa", "competencia", "valor", "vencimento", "link_block"],
        "botoes": [],
        "event_types": [CommunicationEventType.GUIDE_OVERDUE.value],
    },
    {
        "id": "tpl_manual_a",
        "nome": "Lembrete manual A",
        "categoria": "manual",
        "ativo": True,
        "idioma": "pt-BR",
        "corpo": (
            "*GuiaControl — lembrete*\n\n"
            "{{mensagem}}{{extra_block}}{{link_block}}"
        ),
        "variaveis": ["mensagem", "extra_block", "link_block"],
        "botoes": [],
        "event_types": [
            CommunicationEventType.MANUAL_REMINDER.value,
            CommunicationEventType.ACCOUNTANT_NOTIFICATION.value,
        ],
    },
    {
        "id": "tpl_created_a",
        "nome": "Nova guia A",
        "categoria": "aviso",
        "ativo": True,
        "idioma": "pt-BR",
        "corpo": (
            "*GuiaControl — nova guia*\n\n"
            "Foi disponibilizada a guia *{{competencia}}* de {{empresa}} "
            "(*{{valor}}*, vencimento {{vencimento}}).{{link_block}}"
        ),
        "variaveis": ["empresa", "competencia", "valor", "vencimento", "link_block"],
        "botoes": [],
        "event_types": [
            CommunicationEventType.GUIDE_CREATED.value,
            CommunicationEventType.DOCUMENT_AVAILABLE.value,
        ],
    },
    {
        "id": "tpl_test_a",
        "nome": "Teste",
        "categoria": "sistema",
        "ativo": True,
        "idioma": "pt-BR",
        "corpo": "{{mensagem}}",
        "variaveis": ["mensagem"],
        "botoes": [],
        "event_types": [CommunicationEventType.TEST_MESSAGE.value],
    },
]


async def seed_templates(repo: TemplatesRepository) -> int:
    for tpl in SEED_TEMPLATES:
        await repo.upsert(tpl)
    return len(SEED_TEMPLATES)
