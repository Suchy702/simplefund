from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NbpReferenceRate(Base):
    __tablename__ = "nbp_reference_rates"
    __table_args__ = (
        CheckConstraint("rate_pct >= 0 AND rate_pct < 100", name="ck_nbp_rate_range"),
    )

    effective_from: Mapped[date] = mapped_column(Date, primary_key=True)
    rate_pct: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class PolishInflation(Base):
    __tablename__ = "polish_inflation"
    __table_args__ = (
        CheckConstraint("EXTRACT(DAY FROM month) = 1", name="ck_inflation_month_start"),
        CheckConstraint(
            "rate_pct > -100 AND rate_pct < 10000", name="ck_inflation_range"
        ),
    )

    # Month measured by GUS, not the publication month. Rate is CPI year over year.
    month: Mapped[date] = mapped_column(Date, primary_key=True)
    rate_pct: Mapped[Decimal] = mapped_column(Numeric(9, 4), nullable=False)
    source_flag: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
