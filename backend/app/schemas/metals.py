from datetime import date as Date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.models.enums import Currency
from app.models.metals import Metal
from app.schemas.portfolio import ApiModel


class MetalInstrument(ApiModel):
    metal: Metal
    name: str
    yahoo_symbol: str
    quantity_unit: Literal["g"] = "g"


class MetalPriceSuggestion(ApiModel):
    metal: Metal
    currency: Currency
    price_per_gram: Decimal
    price_date: Date
    requested_date: Date
    usd_rate_date: Date | None = None
    currency_rate_date: Date | None = None


class MetalOperationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel)

    metal: Metal
    operation_type: Literal["buy", "sell"]
    grams: Decimal = Field(gt=0, max_digits=18, decimal_places=8)
    price_per_gram: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    currency: Currency
    date: Date

    @field_validator("date")
    @classmethod
    def no_future_date(cls, value: Date) -> Date:
        if value > Date.today():
            raise ValueError("Data operacji nie może być w przyszłości")
        return value
