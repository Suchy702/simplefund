import json
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from http.client import HTTPException
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field, TypeAdapter

from app.schemas.admin import (
    CurrencyConnectionCheck,
    ExternalConnectionCheck,
    ExternalService,
)

FRANKFURTER_URL = (
    "https://api.frankfurter.dev/v2/rates?base=PLN&quotes=EUR%2CUSD%2CGBP%2CCHF"
)
SUPPORTED_CURRENCIES = ("EUR", "USD", "GBP", "CHF")
EXTERNAL_SOURCES: dict[ExternalService, tuple[str, str]] = {
    "bonds": ("Obligacje skarbowe", "https://www.obligacjeskarbowe.pl/"),
    "nbp": (
        "Stopy procentowe NBP",
        "https://nbp.pl/polityka-pieniezna/decyzje-rpp/podstawowe-stopy-procentowe-nbp/",
    ),
    "gus": (
        "Inflacja GUS",
        "https://stat.gov.pl/obszary-tematyczne/ceny-handel/wskazniki-cen/"
        "wskazniki-cen-towarow-i-uslug-konsumpcyjnych-pot-inflacja-/"
        "miesieczne-wskazniki-cen-towarow-i-uslug-konsumpcyjnych-od-1982-roku/",
    ),
}


def check_external_connection(service: ExternalService) -> ExternalConnectionCheck:
    if service in ("history-yahoo", "history-fx"):
        return _check_history_connection(service, int(monotonic() // 300))
    name, url = EXTERNAL_SOURCES[service]
    started = monotonic()
    status = "error"
    try:
        request = Request(
            url,
            headers={"User-Agent": "SimpleFund/1.0", "Accept": "text/html"},
        )
        with urlopen(request, timeout=5) as response:
            if not 200 <= response.status < 300 or not response.read(1024).strip():
                raise ValueError("Empty or unsuccessful response")
            detail = f"{name}: serwis odpowiada (HTTP {response.status})."
        status = "ok"
    except HTTPError as exc:
        detail = f"{name}: serwis zwrócił błąd HTTP {exc.code}."
    except (URLError, OSError, ValueError, HTTPException):
        detail = f"{name}: nie udało się pobrać odpowiedzi. Spróbuj ponownie."
    return ExternalConnectionCheck(
        status=status,
        detail=detail,
        checked_at=datetime.now(timezone.utc),
        response_time_ms=round((monotonic() - started) * 1000),
        source_url=url,
    )


@lru_cache(maxsize=8)
def _check_history_connection(
    service: str, cache_window: int
) -> ExternalConnectionCheck:
    from app.services.history_sources import fetch_fx_history, fetch_yahoo_history

    started = monotonic()
    end = datetime.now(timezone.utc).date() - timedelta(days=1)
    start = end - timedelta(days=14)
    yahoo = service == "history-yahoo"
    url = (
        "https://finance.yahoo.com/quote/AAPL/history/"
        if yahoo
        else "https://api.frankfurter.dev/v2/rates"
    )
    label = "Yahoo AAPL" if yahoo else "Frankfurter EUR/PLN"
    status = "error"
    try:
        result = (
            fetch_yahoo_history("AAPL", start, end)
            if yahoo
            else fetch_fx_history("EUR", start, end)
        )
        if len(result["observations"]) < 2:
            raise ValueError("Insufficient historical observations")
        dates = sorted(result["observations"])
        detail = (
            f"{label}: zweryfikowano {len(dates)} dziennych obserwacji "
            f"({dates[0]} – {dates[-1]}). "
            "Kontrola nie potwierdza kompletności danych w bazie."
        )
        status = "ok"
    except Exception:
        detail = (
            f"{label}: nie udało się pobrać poprawnej serii historycznej. "
            "Sprawdź połączenie lub dostępność danych dostawcy."
        )
    return ExternalConnectionCheck(
        status=status,
        detail=detail,
        source_url=url,
        checked_at=datetime.now(timezone.utc),
        response_time_ms=round((monotonic() - started) * 1000),
    )


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
