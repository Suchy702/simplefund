import datetime
import uuid
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import AssetType, Currency, TransactionType


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id"), nullable=False
    )
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False)
    asset_type: Mapped[AssetType] = mapped_column(Enum(AssetType), nullable=False)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    currency: Mapped[Currency] = mapped_column(Enum(Currency), nullable=False)
    external_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.datetime.now
    )


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("transactions.id"), primary_key=True
    )
    stock_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stocks.id"), nullable=False)
    volume: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
    price_per_unit: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)


class DepositTransaction(Base):
    __tablename__ = "deposit_transactions"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("transactions.id"), primary_key=True
    )
    value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    annual_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    maturity_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)


class BondTransaction(Base):
    __tablename__ = "bond_transactions"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("transactions.id"), primary_key=True
    )
    series_code: Mapped[str] = mapped_column(
        ForeignKey("bond_series.series_code"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price_per_unit: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )


class CashTransaction(Base):
    __tablename__ = "cash_transactions"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("transactions.id"), primary_key=True
    )
    value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
