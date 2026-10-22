from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from app.models import DepositTransaction, ExchangeRate, Transaction
from app.models.enums import AssetType, Currency, TransactionType
from app.services.portfolio import list_holdings

TODAY = date(2026, 10, 22)


@pytest.fixture
def portfolio(monkeypatch):
    class FixedDate(date):
        @classmethod
        def today(cls):
            return TODAY

    monkeypatch.setattr("app.services.portfolio.date", FixedDate)
    rows, rates = [], []
    monkeypatch.setattr("app.services.portfolio.transaction_rows", lambda *_: rows)
    monkeypatch.setattr("app.services.portfolio.exchange_rates", lambda *_: rates)
    monkeypatch.setattr("app.services.portfolio.stock_prices", lambda *_: ([], []))

    def add_deposit(
        elapsed=365,
        term=1825,
        value="1000",
        annual_rate="2",
        currency=Currency.PLN,
        operation_type=TransactionType.buy,
    ):
        start = TODAY - timedelta(days=elapsed)
        transaction = Transaction(
            id=uuid4(),
            user_id=uuid4(),
            type=operation_type,
            asset_type=AssetType.deposit,
            date=start,
            currency=currency,
        )
        deposit = DepositTransaction(
            transaction_id=transaction.id,
            value=Decimal(value),
            annual_rate=Decimal(annual_rate),
            start_date=start,
            maturity_date=start + timedelta(days=term),
        )
        rows.append((transaction, None, None, None, deposit, None))

    return add_deposit, rates


@pytest.mark.parametrize(
    "elapsed,annual_rate,expected",
    [
        (0, "2", "1000"),
        (1, "2", "1000.054794520547945205479452"),
        (365, "2", "1020"),
        (730, "2", "1040"),
        (1825, "2", "1100"),
        (2000, "2", "1100"),
        (365, "0", "1000"),
    ],
)
def test_simple_interest_until_maturity(portfolio, elapsed, annual_rate, expected):
    add_deposit, _ = portfolio
    add_deposit(elapsed=elapsed, annual_rate=annual_rate)
    holding = list_holdings(None, uuid4())[0]
    assert holding.qty == Decimal("1000")
    assert holding.cost == Decimal("1000")
    assert holding.value == pytest.approx(Decimal(expected))
    assert holding.change == pytest.approx(Decimal(expected) - Decimal("1000"))
    assert holding.change_pct == pytest.approx(
        (Decimal(expected) - Decimal("1000")) / Decimal("10")
    )


def test_identical_deposits_are_valued_together(portfolio):
    add_deposit, _ = portfolio
    add_deposit()
    add_deposit(value="2000")
    holdings = list_holdings(None, uuid4())
    assert len(holdings) == 1
    assert holdings[0].value == Decimal("3060")
    assert holdings[0].change == Decimal("60")


def test_different_terms_are_valued_separately(portfolio):
    add_deposit, _ = portfolio
    add_deposit()
    add_deposit(elapsed=730)
    assert [h.value for h in list_holdings(None, uuid4())] == [
        Decimal("1020"),
        Decimal("1040"),
    ]


def test_foreign_deposit_uses_current_fx_and_historical_cost(portfolio):
    add_deposit, rates = portfolio
    add_deposit(currency=Currency.EUR)
    rates.extend(
        [
            ExchangeRate(
                currency=Currency.EUR,
                rate_date=TODAY - timedelta(days=365),
                rate=Decimal("4"),
            ),
            ExchangeRate(currency=Currency.EUR, rate_date=TODAY, rate=Decimal("4.5")),
        ]
    )
    holding = list_holdings(None, uuid4())[0]
    assert holding.cost == Decimal("4000")
    assert holding.value == Decimal("4590")
    assert holding.change == Decimal("590")
    assert holding.change_pct == Decimal("14.75")


def test_missing_fx_keeps_valuation_unavailable(portfolio):
    add_deposit, _ = portfolio
    add_deposit(currency=Currency.EUR)
    holding = list_holdings(None, uuid4())[0]
    assert holding.value is None
    assert holding.change is None
    assert holding.change_pct is None


def test_partial_sale_values_remaining_principal(portfolio):
    add_deposit, _ = portfolio
    add_deposit()
    add_deposit(value="250", operation_type=TransactionType.sell)
    holding = list_holdings(None, uuid4())[0]
    assert holding.qty == Decimal("750")
    assert holding.cost == Decimal("750")
    assert holding.value == Decimal("765")
    assert holding.change == Decimal("15")
