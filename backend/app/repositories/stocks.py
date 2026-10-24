from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import Stock, StockTransaction, Transaction
from app.models.enums import TransactionType


def held_stocks(db: Session, user_id: UUID) -> list[Stock]:
    quantity = case(
        (Transaction.type == TransactionType.buy, StockTransaction.volume),
        else_=-StockTransaction.volume,
    )
    return list(
        db.scalars(
            select(Stock)
            .join(StockTransaction, StockTransaction.stock_id == Stock.id)
            .join(Transaction, Transaction.id == StockTransaction.transaction_id)
            .where(Transaction.user_id == user_id, Transaction.date <= date.today())
            .group_by(Stock.id)
            .having(func.sum(quantity) > 0)
            .order_by(Stock.name, Stock.ticker)
        ).all()
    )


def validate_stock_position(db: Session, user_id: UUID, stock_id: UUID) -> None:
    """Check the complete ledger, including later sales after a backdated edit."""
    rows = db.execute(
        select(Transaction.type, StockTransaction.volume)
        .join(StockTransaction, StockTransaction.transaction_id == Transaction.id)
        .where(Transaction.user_id == user_id, StockTransaction.stock_id == stock_id)
        .order_by(Transaction.date, Transaction.created_at, Transaction.id)
    )
    quantity = Decimal(0)
    for operation_type, volume in rows:
        quantity += volume if operation_type == TransactionType.buy else -volume
        if quantity < 0:
            raise HTTPException(
                409,
                "Operacja spowodowałaby sprzedaż większej liczby jednostek niż "
                "posiadana. Sprawdź daty i późniejsze transakcje tego instrumentu.",
            )
