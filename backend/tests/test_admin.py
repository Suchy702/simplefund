import io
import json
from datetime import date
from urllib.error import URLError
from uuid import uuid4

import pandas as pd
import pytest
from app.database import get_db
from app.dependencies import get_current_user
from app.main import app
from app.models.profiles import Profile
from app.services.admin import FRANKFURTER_URL, check_currency_connection
from app.services.stock_connection import check_stock_connection
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool


@pytest.fixture
def admin_context():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Profile.__table__.create(engine)
    user = {"sub": str(uuid4()), "user_metadata": {"role": "admin"}}

    def database():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        with TestClient(app) as client:
            yield client, engine, user
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def add_profile(engine, user, role):
    from uuid import UUID

    with Session(engine) as session:
        session.add(Profile(id=UUID(user["sub"]), email="test@example.com", role=role))
        session.commit()


def mock_frankfurter(monkeypatch, payload=None, failure=None):
    if payload is None:
        payload = [
            {"date": "2026-10-22", "base": "PLN", "quote": code, "rate": rate}
            for code, rate in {
                "EUR": 0.25,
                "USD": 0.27,
                "GBP": 0.2,
                "CHF": 0.22,
            }.items()
        ]
    calls = []

    def open_url(request, timeout):
        calls.append((request.full_url, timeout))
        assert request.get_header("User-agent") == "SimpleFund/1.0"
        assert request.get_header("Accept") == "application/json"
        if failure:
            raise failure
        return io.BytesIO(json.dumps(payload).encode())

    monkeypatch.setattr("app.services.admin.urlopen", open_url)
    return calls


@pytest.mark.parametrize("role", [None, "user"])
def test_non_admin_cannot_run_checks_even_with_admin_metadata(
    admin_context, monkeypatch, role
):
    client, engine, user = admin_context
    if role:
        add_profile(engine, user, role)
    calls = mock_frankfurter(monkeypatch)
    assert client.get("/api/v1/admin/connections").status_code == 403
    assert calls == []


def test_admin_checks_return_real_provider_data_and_recheck_role(
    admin_context, monkeypatch
):
    client, engine, user = admin_context
    add_profile(engine, user, "admin")
    calls = mock_frankfurter(monkeypatch)
    response = client.get("/api/v1/admin/connections")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    data = response.json()
    assert data["backend"]["status"] == "ok"
    assert data["currency"]["status"] == "ok"
    assert data["currency"]["rates"]["EUR"] == 4.0
    assert data["currency"]["rate_dates"]["EUR"] == "2026-10-22"
    assert calls == [(FRANKFURTER_URL, 5)]
    with Session(engine) as session:
        profile = session.query(Profile).one()
        profile.role = "user"
        session.commit()
    assert client.get("/api/v1/admin/connections").status_code == 403
    assert len(calls) == 1


def test_anonymous_cannot_run_admin_checks(admin_context, monkeypatch):
    client, _, _ = admin_context
    app.dependency_overrides.pop(get_current_user)
    calls = mock_frankfurter(monkeypatch)
    assert client.get("/api/v1/admin/connections").status_code in (401, 403)
    assert calls == []


def test_failed_role_lookup_does_not_expose_database_details(
    admin_context, monkeypatch
):
    client, _, _ = admin_context

    class BrokenDatabase:
        def get(self, *args):
            raise OperationalError("sensitive connection details", {}, Exception())

    app.dependency_overrides[get_db] = lambda: BrokenDatabase()
    calls = mock_frankfurter(monkeypatch)
    response = client.get("/api/v1/admin/connections")
    assert response.status_code == 503
    assert "sensitive" not in response.text
    assert calls == []


def test_provider_failure_keeps_backend_healthy(admin_context, monkeypatch):
    client, engine, user = admin_context
    add_profile(engine, user, "admin")
    mock_frankfurter(monkeypatch, failure=URLError("private upstream details"))
    response = client.get("/api/v1/admin/connections")
    assert response.status_code == 200
    assert response.json()["backend"]["status"] == "ok"
    assert response.json()["currency"]["status"] == "error"
    assert "private upstream" not in response.text


@pytest.mark.parametrize(
    "payload",
    [[], {"error": "upstream error"}, [{"date": "invalid"}]],
)
def test_invalid_provider_data_is_not_reported_as_connected(monkeypatch, payload):
    mock_frankfurter(monkeypatch, payload=payload)
    result = check_currency_connection()
    assert result.status == "error"
    assert result.rates is None


@pytest.mark.parametrize(
    "changes",
    [
        {"rate": -1},
        {"rate": 0},
        {"rate": "NaN"},
        {"rate": "Infinity"},
        {"base": "USD"},
        {"quote": "EUR"},
        {"date": "invalid"},
    ],
)
def test_invalid_currency_pair_is_rejected(monkeypatch, changes):
    payload = [
        {"date": "2026-10-22", "base": "PLN", "quote": code, "rate": 0.25}
        for code in ("EUR", "USD", "GBP", "CHF")
    ]
    payload[-1].update(changes)
    mock_frankfurter(monkeypatch, payload=payload)
    assert check_currency_connection().status == "error"


def test_different_currency_dates_are_preserved(monkeypatch):
    payload = [
        {"date": "2026-10-22", "base": "PLN", "quote": code, "rate": 0.25}
        for code in ("EUR", "USD", "GBP", "CHF")
    ]
    payload[-1]["date"] = "2026-10-21"
    mock_frankfurter(monkeypatch, payload=payload)
    result = check_currency_connection()
    assert result.status == "ok"
    assert result.rate_dates["EUR"] == date(2026, 10, 22)
    assert result.rate_dates["CHF"] == date(2026, 10, 21)


def test_provider_timeout_is_reported_as_failed_check(monkeypatch):
    mock_frankfurter(monkeypatch, failure=TimeoutError())
    assert check_currency_connection().status == "error"


def mock_stock(monkeypatch, price=200.5, currency="USD", empty=False, failure=None):
    calls = []

    class Stock:
        def history(self, **kwargs):
            calls.append(kwargs)
            if failure:
                raise failure
            if empty:
                return pd.DataFrame()
            return pd.DataFrame(
                {"Close": [price]}, index=pd.to_datetime(["2026-10-22"])
            )

        def get_history_metadata(self):
            return {"currency": currency}

    def ticker(symbol):
        assert symbol == "AAPL"
        return Stock()

    monkeypatch.setattr("app.services.stock_connection.yf.Ticker", ticker)
    return calls


def test_admin_can_check_stock_provider(admin_context, monkeypatch):
    client, engine, user = admin_context
    add_profile(engine, user, "admin")
    calls = mock_stock(monkeypatch)
    response = client.get("/api/v1/admin/connections/stocks")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    data = response.json()
    assert data["status"] == "ok"
    assert data["symbol"] == "AAPL"
    assert data["price"] == 200.5
    assert data["currency"] == "USD"
    assert data["price_date"] == "2026-10-22"
    assert calls == [
        {
            "period": "5d",
            "interval": "1d",
            "auto_adjust": False,
            "timeout": 5,
            "raise_errors": True,
        }
    ]


@pytest.mark.parametrize("role", [None, "user"])
def test_non_admin_cannot_query_stock_provider(admin_context, monkeypatch, role):
    client, engine, user = admin_context
    if role:
        add_profile(engine, user, role)
    calls = mock_stock(monkeypatch)
    assert client.get("/api/v1/admin/connections/stocks").status_code == 403
    assert calls == []


def test_stock_endpoint_requires_authentication(admin_context, monkeypatch):
    client, _, _ = admin_context
    app.dependency_overrides.pop(get_current_user)
    calls = mock_stock(monkeypatch)
    assert client.get("/api/v1/admin/connections/stocks").status_code in (401, 403)
    assert calls == []


@pytest.mark.parametrize(
    "options",
    [
        {"price": float("nan")},
        {"price": float("inf")},
        {"price": -1},
        {"price": 0},
        {"empty": True},
        {"currency": None},
        {"failure": TimeoutError("sensitive provider details")},
        {"failure": RuntimeError("sensitive provider details")},
    ],
)
def test_stock_failure_does_not_report_success_or_expose_details(monkeypatch, options):
    mock_stock(monkeypatch, **options)
    result = check_stock_connection()
    assert result.status == "error"
    assert result.price is None
    assert "sensitive" not in result.detail
