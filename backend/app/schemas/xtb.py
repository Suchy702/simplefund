from typing import Literal
from uuid import UUID

from pydantic import Field

from app.models.enums import Currency
from app.schemas.portfolio import ApiModel
from app.schemas.stocks import StockInstrument


class XtbChoice(ApiModel):
    mode: Literal["yahoo", "skip", "unresolved"]
    ticker: str | None = Field(default=None, max_length=64, pattern=r"^\S+$")


class XtbResolution(ApiModel):
    choices: dict[str, XtbChoice]
    currencies: dict[str, Currency]
    revision: int = Field(ge=1)


class XtbCommit(ApiModel):
    import_id: UUID
    revision: int = Field(ge=1)
    confirmed: Literal[True]


class XtbInstrument(ApiModel):
    source_ticker: str
    name: str
    category: str
    choice: XtbChoice
    selected: StockInstrument | None = None
    candidates: list[StockInstrument]
    status: Literal["automatic", "saved", "changed", "unresolved"]
    warning: str | None = None
    issues: list[str]


class XtbAccount(ApiModel):
    account: str
    filename: str
    currency: Currency | None
    is_ike: bool = False
    operation_count: int


class XtbSummary(ApiModel):
    new_operations: int
    duplicates: int
    skipped_trades: int
    cash_operations: int


class XtbPreview(ApiModel):
    import_id: UUID
    revision: int
    accounts: list[XtbAccount]
    instruments: list[XtbInstrument]
    warnings: list[str]
    errors: list[str]
    summary: XtbSummary
    can_import: bool


class XtbResult(ApiModel):
    imported: int
    duplicates: int
    skipped_trades: int
