from datetime import date
from uuid import UUID

from sqlalchemy import select
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


def exchange_rates(db: Session):
    return db.scalars(
        select(ExchangeRate)
        .where(ExchangeRate.rate_date <= date.today())
        .order_by(ExchangeRate.rate_date)
    ).all()


def stock_prices(db: Session, user_id: UUID):
    market = db.scalars(
        select(AssetPrice)
        .join(Stock, Stock.id == AssetPrice.stock_id)
        .where(
            AssetPrice.price_date <= date.today(),
            Stock.manual_price_only.is_(False),
        )
        .order_by(AssetPrice.price_date)
    ).all()
    manual = db.scalars(
        select(ManualPrice)
        .where(ManualPrice.user_id == user_id, ManualPrice.price_date <= date.today())
        .order_by(ManualPrice.price_date)
    ).all()
    return market, manual
