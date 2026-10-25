from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import InterestType


class BondSeries(Base):
    __tablename__ = "bond_series"
    __table_args__ = (
        CheckConstraint("sale_end >= sale_start", name="ck_bond_series_sale_dates"),
        CheckConstraint("term_months > 0", name="ck_bond_series_term"),
        CheckConstraint(
            "fixed_rate_pct >= 0 AND first_period_rate_pct >= 0 "
            "AND inflation_margin_pp >= 0",
            name="ck_bond_series_rates",
        ),
        CheckConstraint("nbp_margin_pp >= 0", name="ck_bond_series_nbp_margin"),
    )

    series_code: Mapped[str] = mapped_column(String, primary_key=True)
    interest_type: Mapped[InterestType] = mapped_column(
        Enum(InterestType), nullable=False
    )
    annual_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    family: Mapped[str | None] = mapped_column(String, nullable=True)
    sale_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    sale_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fixed_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    first_period_rate_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(7, 4), nullable=True
    )
    inflation_margin_pp: Mapped[Decimal | None] = mapped_column(
        Numeric(7, 4), nullable=True
    )
    nbp_margin_pp: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    capitalization: Mapped[str | None] = mapped_column(String, nullable=True)
    interest_payment: Mapped[str | None] = mapped_column(String, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    issue_letter_url: Mapped[str | None] = mapped_column(String, nullable=True)
    imported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
