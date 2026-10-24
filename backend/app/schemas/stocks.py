from datetime import date as Date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.schemas.portfolio import ApiModel


class StockInstrument(ApiModel):
    ticker: str
    name: str
    exchange: str | None = None
    currency: str | None = None
    quote_type: str | None = None
    can_transact: bool
    unavailable_reason: str | None = None


class StockPriceSuggestion(ApiModel):
    ticker: str
    currency: str
    price: Decimal
    price_date: Date
    requested_date: Date


class StockOperationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel)

    ticker: str = Field(min_length=1, max_length=64, pattern=r"^\S+$")
    operation_type: Literal["buy", "sell"]
    volume: Decimal = Field(gt=0, max_digits=18, decimal_places=8)
    price_per_unit: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    date: Date

    @field_validator("date")
    @classmethod
    def no_future_date(cls, value: Date) -> Date:
        if value > Date.today():
            raise ValueError("Data operacji nie może być w przyszłości")
        return value
