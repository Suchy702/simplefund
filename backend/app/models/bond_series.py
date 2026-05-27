from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import InterestType


class BondSeries(Base):
    __tablename__ = "bond_series"

    series_code: Mapped[str] = mapped_column(String, primary_key=True)
    interest_type: Mapped[InterestType] = mapped_column(
        Enum(InterestType), nullable=False
    )
    annual_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
