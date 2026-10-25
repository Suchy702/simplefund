from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Family = Literal["ROD", "ROS", "COI", "EDO", "TOS", "DOR", "ROR", "OTS"]


class Issue(BaseModel):
    model_config = ConfigDict(frozen=True)

    series_code: str
    family: Family
    sale_start: date
    sale_end: date
    term_months: int
    interest_type: Literal["fixed", "inflation_linked", "reference_rate_linked"]
    fixed_rate_pct: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    first_period_rate_pct: Decimal | None = Field(
        default=None, ge=0, allow_inf_nan=False
    )
    inflation_margin_pp: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    nbp_margin_pp: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    capitalization: str
    interest_payment: str
    source_url: str
    issue_letter_url: str

    @model_validator(mode="after")
    def validate_terms(self) -> "Issue":
        if self.sale_end < self.sale_start:
            raise ValueError("Sale end precedes sale start")
        if self.interest_type == "fixed":
            if (
                self.fixed_rate_pct is None
                or self.first_period_rate_pct is not None
                or self.inflation_margin_pp is not None
                or self.nbp_margin_pp is not None
            ):
                raise ValueError("Invalid fixed interest terms")
        elif self.interest_type == "inflation_linked" and (
            self.fixed_rate_pct is not None
            or self.first_period_rate_pct is None
            or self.inflation_margin_pp is None
            or self.nbp_margin_pp is not None
        ):
            raise ValueError("Incomplete inflation-linked terms")
        elif self.interest_type == "reference_rate_linked" and (
            self.fixed_rate_pct is not None
            or self.first_period_rate_pct is None
            or self.nbp_margin_pp is None
            or self.inflation_margin_pp is not None
        ):
            raise ValueError("Incomplete NBP-linked terms")
        expected = (
            "fixed"
            if self.family in {"TOS", "OTS"}
            else "reference_rate_linked"
            if self.family in {"ROR", "DOR"}
            else "inflation_linked"
        )
        if self.interest_type != expected:
            raise ValueError("Interest type does not match the family")
        return self


class ScrapeError(BaseModel):
    source_url: str
    series_code: str | None = None
    message: str


class ScrapeResult(BaseModel):
    issues: list[Issue] = Field(default_factory=list)
    errors: list[ScrapeError] = Field(default_factory=list)

    @property
    def complete(self) -> bool:
        return not self.errors
