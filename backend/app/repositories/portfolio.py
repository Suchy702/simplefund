from collections.abc import Iterable
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, column, select, true, values
from sqlalchemy.orm import Session

from app.models import (
    AssetPrice,
    BondTransaction,
    CashTransaction,
    DepositTransaction,
    ExchangeRate,
    ManualPrice,
    Stock,
    StockTransaction,
    Transaction,
)
from app.models.enums import Currency


def transaction_rows(db: Session, user_id: UUID):
    return db.execute(
        select(
            Transaction,
            CashTransaction,
            StockTransaction,
            Stock,
            DepositTransaction,
            BondTransaction,
        )
        .select_from(Transaction)
        .outerjoin(CashTransaction, CashTransaction.transaction_id == Transaction.id)
        .outerjoin(StockTransaction, StockTransaction.transaction_id == Transaction.id)
        .outerjoin(Stock, Stock.id == StockTransaction.stock_id)
        .outerjoin(
            DepositTransaction, DepositTransaction.transaction_id == Transaction.id
        )
        .outerjoin(BondTransaction, BondTransaction.transaction_id == Transaction.id)
        .where(Transaction.user_id == user_id, Transaction.date <= date.today())
        .order_by(Transaction.date, Transaction.created_at, Transaction.id)
    ).all()


def exchange_rates(
    db: Session, requests: Iterable[tuple[Currency, date]] | None = None
):
    if requests is None:
        return db.scalars(
            select(ExchangeRate)
            .where(ExchangeRate.rate_date <= date.today())
            .order_by(ExchangeRate.rate_date)
        ).all()
    needed = sorted(
        {(currency, on) for currency, on in requests if currency != Currency.PLN},
        key=lambda item: (item[0].value, item[1]),
    )
    if not needed:
        return []
    requested = values(
        column("currency", ExchangeRate.currency.type),
        column("on_date", Date),
        name="requested_rates",
    ).data(needed)
    latest = (
        select(ExchangeRate.id)
        .where(
            ExchangeRate.currency
            == requested.c.currency.cast(ExchangeRate.currency.type),
            ExchangeRate.rate_date <= requested.c.on_date,
            ExchangeRate.rate > 0,
            ExchangeRate.rate != Decimal("NaN"),
        )
        .order_by(ExchangeRate.rate_date.desc())
        .limit(1)
        .lateral()
    )
    return db.scalars(
        select(ExchangeRate).where(
            ExchangeRate.id.in_(
                select(latest.c.id).select_from(requested.join(latest, true()))
            )
        )
    ).all()


def stock_prices(db: Session, user_id: UUID, stock_ids: Iterable[UUID]):
    stock_ids = set(stock_ids)
    if not stock_ids:
        return [], []
    market = db.scalars(
        select(AssetPrice)
        .join(Stock, Stock.id == AssetPrice.stock_id)
        .where(
            AssetPrice.stock_id.in_(stock_ids),
            AssetPrice.price_date <= date.today(),
            Stock.manual_price_only.is_(False),
        )
        .distinct(AssetPrice.stock_id)
        .order_by(AssetPrice.stock_id, AssetPrice.price_date.desc())
    ).all()
    manual = db.scalars(
        select(ManualPrice)
        .where(
            ManualPrice.user_id == user_id,
            ManualPrice.stock_id.in_(stock_ids),
            ManualPrice.price_date <= date.today(),
        )
        .distinct(ManualPrice.stock_id)
        .order_by(ManualPrice.stock_id, ManualPrice.price_date.desc())
    ).all()
    return market, manual
