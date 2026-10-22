from datetime import date as Date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator
from pydantic.alias_generators import to_camel

from app.models.enums import Currency

Amount = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class CashOperationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel)

    operation_type: Literal["deposit", "withdrawal"]
    value: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    currency: Currency
    date: Date

    @field_validator("date")
    @classmethod
    def no_future_date(cls, value: Date) -> Date:
        if value > Date.today():
            raise ValueError("Data operacji nie może być w przyszłości")
        return value


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Operation(ApiModel):
    id: UUID
    type: Literal["buy", "sell", "deposit", "withdrawal"]
    kind: str
    name: str
    qty: Amount | None
    price: Amount | None
    value: Amount | None
    currency: Currency
    date: Date


class Holding(ApiModel):
    id: str
    ticker: str
    name: str
    asset_class: str = Field(serialization_alias="class")
    qty: Amount
    currency: Currency
    price: Amount | None
    cost: Amount | None
    value: Amount | None
    change: Amount | None
    change_pct: Amount | None
    color: str
