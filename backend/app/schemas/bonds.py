from datetime import date as Date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.schemas.portfolio import Amount, ApiModel

BondFamily = Literal["ROD", "ROS", "COI", "EDO", "TOS", "DOR", "ROR", "OTS"]
BOND_FAMILIES = ("ROD", "ROS", "COI", "EDO", "TOS", "DOR", "ROR", "OTS")


class BondSeriesOption(ApiModel):
    series_code: str
    family: BondFamily
    sale_start: Date
    sale_end: Date
    term_months: int
    price_per_unit: Amount
    initial_rate_pct: Amount | None


class BondOperationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel)

    series_code: str = Field(pattern=r"^(ROD|ROS|COI|EDO|TOS|DOR|ROR|OTS)\d{4}$")
    quantity: int = Field(strict=True, gt=0, le=2_147_483_647)
    date: Date

    @field_validator("date")
    @classmethod
    def no_future_date(cls, value: Date) -> Date:
        if value > Date.today():
            raise ValueError("Data zakupu nie może być w przyszłości")
        return value
