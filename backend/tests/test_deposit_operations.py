from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from app.api.v1.router import router
from app.database import get_db
from app.dependencies import get_current_user
from app.models import DepositTransaction, Profile, Transaction
from app.models.base import Base
from app.models.enums import AssetType, TransactionType
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool


@pytest.fixture
def context():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    user = {"sub": str(uuid4()), "email": "owner@example.com"}
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")

    def database():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, engine, user
    engine.dispose()


@pytest.fixture
def payload():
    return {
        "value": "1234.56",
        "currency": "PLN",
        "interestRate": "5.25",
        "startDate": date.today().isoformat(),
        "maturityDate": (date.today() + timedelta(days=90)).isoformat(),
    }


def test_create_deposit_and_read_portfolio(context, payload):
    client, engine, user = context
    response = client.post("/api/v1/transactions/deposit", json=payload)
    assert response.status_code == 201, response.text
    operation = response.json()
    assert operation["kind"] == "Lokata"
    assert operation["type"] == "buy"
    assert operation["value"] == 1234.56
    assert operation["date"] == payload["startDate"]
    with Session(engine) as session:
        transaction = session.scalar(select(Transaction))
        deposit = session.scalar(select(DepositTransaction))
        assert str(transaction.user_id) == user["sub"]
        assert transaction.asset_type == AssetType.deposit
        assert transaction.type == TransactionType.buy
        assert deposit.transaction_id == transaction.id
        assert deposit.value == Decimal("1234.56")
        assert deposit.annual_rate == Decimal("5.25")
        assert deposit.maturity_date.isoformat() == payload["maturityDate"]
    assert client.get("/api/v1/transactions").json() == [operation]
    holdings = client.get("/api/v1/portfolio/holdings").json()
    assert len(holdings) == 1
    assert holdings[0]["class"] == "Lokata"
    assert holdings[0]["qty"] == 1234.56
    assert holdings[0]["currency"] == "PLN"
    user.update(sub=str(uuid4()), email="other@example.com")
    assert client.get("/api/v1/transactions").json() == []
    assert client.get("/api/v1/portfolio/holdings").json() == []


@pytest.mark.parametrize(
    "changes",
    [
        {"value": "0"},
        {"value": "-1"},
        {"value": "1.001"},
        {"value": "10000000000000000"},
        {"value": "NaN"},
        {"currency": "XXX"},
        {"interestRate": "-0.01"},
        {"interestRate": "100.01"},
        {"interestRate": "1.001"},
        {"interestRate": "Infinity"},
        {"startDate": (date.today() + timedelta(days=1)).isoformat()},
        {"maturityDate": date.today().isoformat()},
        {"maturityDate": (date.today() - timedelta(days=1)).isoformat()},
        {"maturityDate": "invalid"},
        {"userId": str(uuid4())},
        {"operationType": "sell"},
    ],
)
def test_invalid_deposit_is_rejected_without_writes(context, payload, changes):
    client, engine, _ = context
    response = client.post("/api/v1/transactions/deposit", json=payload | changes)
    assert response.status_code == 422, response.text
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Transaction)) == 0
        assert session.scalar(select(func.count()).select_from(Profile)) == 0


@pytest.mark.parametrize("rate", ["0", "100"])
def test_rate_boundaries_and_existing_profile(context, payload, rate):
    client, engine, _ = context
    payload["interestRate"] = rate
    for _ in range(2):
        response = client.post("/api/v1/transactions/deposit", json=payload)
        assert response.status_code == 201, response.text
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Profile)) == 1
        assert session.scalar(select(func.count()).select_from(DepositTransaction)) == 2


def test_missing_email(context, payload):
    client, engine, user = context
    user.pop("email")
    assert client.post("/api/v1/transactions/deposit", json=payload).status_code == 400
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Transaction)) == 0


def test_failed_deposit_rolls_back_parent_transaction(context, payload):
    client, engine, _ = context

    def fail_insert(*args):
        raise RuntimeError("Simulated deposit insert failure")

    event.listen(DepositTransaction, "before_insert", fail_insert)
    try:
        response = client.post("/api/v1/transactions/deposit", json=payload)
        assert response.status_code == 500
    finally:
        event.remove(DepositTransaction, "before_insert", fail_insert)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Transaction)) == 0
        assert session.scalar(select(func.count()).select_from(DepositTransaction)) == 0
        assert session.scalar(select(func.count()).select_from(Profile)) == 0
