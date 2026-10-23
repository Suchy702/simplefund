from datetime import date as Date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    field_validator,
    model_validator,
)
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


class DepositOperationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel)

    value: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    currency: Currency
    interest_rate: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    start_date: Date
    maturity_date: Date

    @model_validator(mode="after")
    def valid_dates(self) -> "DepositOperationCreate":
        if self.start_date > Date.today():
            raise ValueError("Data rozpoczęcia nie może być w przyszłości")
        if self.maturity_date <= self.start_date:
            raise ValueError(
                "Data zapadalności musi być późniejsza niż data rozpoczęcia"
            )
        return self


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


class AllocationSegment(ApiModel):
    name: str
    pct: Amount
    color: str


class PortfolioAllocation(ApiModel):
    outer: list[AllocationSegment]
    inner: list[AllocationSegment]
    unvalued_count: int


PortfolioRange = Literal["1M", "3M", "6M", "1R", "MAX"]


class PortfolioKpi(ApiModel):
    as_of_date: Date
    currency: Literal["PLN"] = "PLN"
    total_contrib: Amount | None = Field(
        description="Net purchases and cash deposits less sales and withdrawals, "
        "converted to PLN at historical FX rates. Trades do not debit cash."
    )
    total_value: Amount | None
    balance: Amount | None
    roi: Amount | None = Field(description="Profit / positive net contributions, in %.")
    cagr: Amount | None = Field(
        description="Annualized geometrically linked daily returns, adjusted for "
        "end-of-day flows, using a 365-day year. Null for incomplete history."
    )
    unvalued_count: int


class PortfolioPoint(ApiModel):
    date: Date
    value: Amount | None


class PerformanceStatistics(ApiModel):
    peak: Amount
    trough: Amount
    peak_date: Date
    trough_date: Date
    std_pct: Amount | None = Field(
        description="Sample standard deviation of flow-adjusted daily returns, "
        "annualized by sqrt(365), in %. Requires at least two returns."
    )
    max_dd: Amount = Field(
        description="Largest peak-to-trough decline in portfolio value, as a "
        "nonpositive fraction. Includes the effect of deposits and withdrawals."
    )
    max_dd_pln: Amount = Field(
        description="PLN decline belonging to maxDd and its own preceding peak."
    )
    change: Amount = Field(description="Last value minus first value in the range.")
    change_pct: Amount | None


class PortfolioStatistics(ApiModel):
    range: PortfolioRange
    kpi: PortfolioKpi
    series: list[PortfolioPoint]
    performance: PerformanceStatistics | None = Field(
        description="Null for empty history or any missing valuation in this range."
    )
