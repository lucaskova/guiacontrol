"""Testes unitários do CommunicationCenter (sem Redis/Mongo reais)."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from communication.delay import random_send_delay
from communication.domain import OfficeCommSettings
from communication.retry import max_attempts, next_retry_delay
from communication.rules.engine import within_send_window
from communication.templates.service import render_template
from communication.providers.apibrasil import ApiBrasilProvider


def test_random_delay_is_within_bounds_and_varies():
    samples = {round(random_send_delay(30, 60), 3) for _ in range(30)}
    assert all(30 <= s <= 60 for s in samples)
    assert len(samples) > 1


def test_retry_schedule():
    assert next_retry_delay(1) == 5 * 60
    assert next_retry_delay(2) == 15 * 60
    assert next_retry_delay(3) == 30 * 60
    assert next_retry_delay(4) == 60 * 60
    assert next_retry_delay(5) is None
    assert max_attempts() == 4


def test_render_template_variables():
    body = "Ola {{nome}}, guia {{competencia}} de {{valor}}"
    out = render_template(body, {"nome": "Ana", "competencia": "DAS", "valor": "R$ 10,00"})
    assert out == "Ola Ana, guia DAS de R$ 10,00"


def test_phone_normalize():
    ok, err = ApiBrasilProvider.normalize_br_phone("(55) 99982-4552")
    assert err is None
    assert ok == "5555999824552"
    bad, err2 = ApiBrasilProvider.normalize_br_phone("123")
    assert bad is None and err2


def test_send_window_inside():
    settings = OfficeCommSettings(
        accountant_id="u1",
        window_start="08:00",
        window_end="18:00",
        timezone="America/Sao_Paulo",
    )
    when = datetime(2026, 7, 10, 12, 0, tzinfo=ZoneInfo("America/Sao_Paulo"))
    allowed, nxt = within_send_window(settings, when)
    assert allowed is True
    assert nxt is None


def test_send_window_outside():
    settings = OfficeCommSettings(
        accountant_id="u1",
        window_start="08:00",
        window_end="18:00",
        timezone="America/Sao_Paulo",
    )
    when = datetime(2026, 7, 10, 20, 0, tzinfo=ZoneInfo("America/Sao_Paulo"))
    allowed, nxt = within_send_window(settings, when)
    assert allowed is False
    assert nxt is not None
    assert nxt.hour == 8


def test_send_session_defaults_on():
    p = ApiBrasilProvider()
    assert p._should_send_session() is True
    assert p._require_session() is True
