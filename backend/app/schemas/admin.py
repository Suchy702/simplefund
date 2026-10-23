from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class ConnectionCheck(BaseModel):
    status: Literal["ok", "error"]
    detail: str
    checked_at: datetime
    response_time_ms: int | None = None


class CurrencyConnectionCheck(ConnectionCheck):
    rate_dates: dict[str, date] | None = None
    rates: dict[str, float] | None = None


class StockConnectionCheck(ConnectionCheck):
    symbol: str = "AAPL"
    price: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    currency: str | None = None
    price_date: date | None = None


class AdminConnections(BaseModel):
    backend: ConnectionCheck
    currency: CurrencyConnectionCheck
