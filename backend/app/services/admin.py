import json
from datetime import date, datetime, timezone
from http.client import HTTPException
from time import monotonic
from urllib.error import URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field, TypeAdapter

from app.schemas.admin import CurrencyConnectionCheck

FRANKFURTER_URL = (
    "https://api.frankfurter.dev/v2/rates?base=PLN&quotes=EUR%2CUSD%2CGBP%2CCHF"
)
SUPPORTED_CURRENCIES = ("EUR", "USD", "GBP", "CHF")


class FrankfurterRate(BaseModel):
    date: date
    base: str
    quote: str
    rate: float = Field(gt=0, allow_inf_nan=False)


def check_currency_connection() -> CurrencyConnectionCheck:
    started = monotonic()
    try:
        request = Request(
            FRANKFURTER_URL,
            headers={"User-Agent": "SimpleFund/1.0", "Accept": "application/json"},
        )
        with urlopen(request, timeout=5) as response:
            payload = json.load(response)
        rows = TypeAdapter(list[FrankfurterRate]).validate_python(payload)
        if (
            len(rows) != len(SUPPORTED_CURRENCIES)
            or {row.quote for row in rows} != set(SUPPORTED_CURRENCIES)
            or any(row.base != "PLN" for row in rows)
        ):
            raise ValueError("Invalid Frankfurter currency pairs")
        # The API returns foreign currency per PLN; the panel shows PLN per unit.
        selected = {row.quote: 1 / row.rate for row in rows}
        dates = {row.quote: row.date for row in rows}
        return CurrencyConnectionCheck(
            status="ok",
            detail="Pobrano kursy EUR, USD, GBP i CHF względem PLN z Frankfurter.",
            checked_at=datetime.now(timezone.utc),
            response_time_ms=round((monotonic() - started) * 1000),
            rate_dates=dates,
            rates=selected,
        )
    except (URLError, OSError, ValueError, HTTPException):
        return CurrencyConnectionCheck(
            status="error",
            detail=(
                "Nie udało się pobrać poprawnych kursów Frankfurter. Spróbuj ponownie."
            ),
            checked_at=datetime.now(timezone.utc),
            response_time_ms=round((monotonic() - started) * 1000),
        )
