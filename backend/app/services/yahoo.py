import logging
import unicodedata
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from threading import Lock
from time import monotonic
from typing import TypeVar

import yfinance as yf
from fastapi import HTTPException

from app.models.enums import Currency
from app.schemas.stocks import StockInstrument, StockPriceSuggestion

logger = logging.getLogger(__name__)
T = TypeVar("T")
_lock = Lock()
_snapshots: OrderedDict[str, tuple[float, "MarketSnapshot"]] = OrderedDict()
_searches: OrderedDict[str, tuple[float, list[StockInstrument]]] = OrderedDict()
_price_suggestions: OrderedDict[str, tuple[float, StockPriceSuggestion]] = OrderedDict()
_workers = ThreadPoolExecutor(max_workers=4, thread_name_prefix="yahoo")


@dataclass(frozen=True)
class MarketSnapshot:
    instrument: StockInstrument
    prices: tuple[tuple[date, Decimal], ...]


def _get(cache: OrderedDict[str, tuple[float, T]], key: str) -> T | None:
    with _lock:
        entry = cache.get(key)
        if entry is None:
            return None
        if entry[0] <= monotonic():
            del cache[key]
            return None
        cache.move_to_end(key)
        return entry[1]


def _put(cache: OrderedDict[str, tuple[float, T]], key: str, value: T, ttl: int):
    with _lock:
        cache[key] = (monotonic() + ttl, value)
        cache.move_to_end(key)
        while len(cache) > 256:
            cache.popitem(last=False)
    return value


def currency_issue(currency: str | None) -> str | None:
    if currency is None:
        return "Nie udało się ustalić waluty notowania. Spróbuj ponownie."
    if currency not in Currency.__members__:
        return f"Waluta notowania {currency} nie jest jeszcze obsługiwana."
    return None


def market_snapshot(symbol: str, *, use_cache: bool = True) -> MarketSnapshot:
    cached = _get(_snapshots, symbol) if use_cache else None
    if cached is not None:
        return cached
    ticker = yf.Ticker(symbol)
    history = ticker.history(
        period="1mo",
        interval="1d",
        auto_adjust=False,
        actions=False,
        repair=False,
        timeout=5,
        raise_errors=True,
    )
    metadata = ticker.get_history_metadata()
    canonical = metadata.get("symbol")
    if not isinstance(canonical, str) or canonical.upper() != symbol.upper():
        raise ValueError("Yahoo returned a different or missing symbol")
    currency = metadata.get("currency")
    currency = currency if isinstance(currency, str) and currency else None
    issue = currency_issue(currency)
    is_crypto = metadata.get("instrumentType") == "CRYPTOCURRENCY"
    precision = Decimal("0.000000000001") if is_crypto else Decimal("0.0001")
    prices = []
    for timestamp, row in history.iterrows():
        price = Decimal(str(row["Close"]))
        price_date = timestamp.date()
        if is_crypto and price_date >= datetime.now(timezone.utc).date():
            continue
        if (
            price.is_finite()
            and 0 < price < Decimal("100000000000000")
            and price_date <= date.today()
        ):
            rounded = price.quantize(precision)
            if rounded > 0:
                prices.append((price_date, rounded))
    if not prices:
        raise ValueError("Yahoo returned no valid prices")
    instrument = StockInstrument(
        ticker=canonical,
        name=metadata.get("longName") or metadata.get("shortName") or canonical,
        exchange=metadata.get("fullExchangeName") or metadata.get("exchangeName"),
        currency=currency,
        quote_type=metadata.get("instrumentType"),
        can_transact=issue is None,
        unavailable_reason=issue,
    )
    return _put(_snapshots, symbol, MarketSnapshot(instrument, tuple(prices)), ttl=900)


def suggest_stock_price(
    symbol: str, on: date, currency: Currency, *, crypto: bool = False
) -> StockPriceSuggestion:
    if on > date.today():
        raise HTTPException(422, "Data transakcji nie może być w przyszłości")
    key = f"{symbol}:{on.isoformat()}:{currency.value}:{crypto}"
    cached = _get(_price_suggestions, key)
    if cached is not None:
        return cached
    # Cover weekends and exchange holidays without looking ahead in time.
    start = date.fromordinal(max(1, on.toordinal() - 14))
    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(
            start=start.isoformat(),
            end=(on + timedelta(days=1)).isoformat(),
            interval="1d",
            auto_adjust=False,
            actions=False,
            repair=False,
            timeout=5,
            raise_errors=True,
        )
        metadata = ticker.get_history_metadata()
        canonical = metadata.get("symbol")
        if not isinstance(canonical, str) or canonical.upper() != symbol.upper():
            raise ValueError("Yahoo returned a different or missing symbol")
        if crypto and metadata.get("instrumentType") != "CRYPTOCURRENCY":
            raise HTTPException(422, "Wybierz kryptowalutę z Yahoo Finance.")
        if metadata.get("currency") != currency.value:
            raise HTTPException(
                422, "Waluta notowania Yahoo różni się od waluty wybranego instrumentu."
            )
        observations = []
        precision = Decimal("0.000000000001") if crypto else Decimal("0.0001")
        for timestamp, row in history.iterrows():
            price = Decimal(str(row["Close"]))
            price_date = timestamp.date()
            if crypto and price_date >= datetime.now(timezone.utc).date():
                continue
            if (
                start <= price_date <= on
                and price.is_finite()
                and 0 < price < Decimal("100000000000000")
            ):
                rounded = price.quantize(precision)
                if rounded > 0:
                    observations.append((price_date, rounded))
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(
            "Yahoo historical price unavailable for %s", symbol, exc_info=True
        )
        raise HTTPException(
            503, "Nie udało się pobrać ceny Yahoo. Wpisz cenę transakcji ręcznie."
        ) from exc
    if not observations:
        raise HTTPException(
            404,
            "Brak notowań z wybranego dnia i 14 wcześniejszych dni. "
            "Wpisz cenę transakcji ręcznie.",
        )
    price_date, price = max(observations)
    suggestion = StockPriceSuggestion(
        ticker=canonical,
        currency=currency.value,
        price=price,
        price_date=price_date,
        requested_date=on,
    )
    return _put(_price_suggestions, key, suggestion, ttl=900)


def _enrich(quote: dict) -> StockInstrument:
    symbol = quote["symbol"]
    currency = quote.get("currency")
    issue = currency_issue(currency)
    try:
        snapshot = market_snapshot(symbol)
        currency = snapshot.instrument.currency
        issue = snapshot.instrument.unavailable_reason
    except Exception:
        logger.warning("Yahoo metadata unavailable for %s", symbol, exc_info=True)
        # A search hit alone does not establish that usable prices exist.
        issue = "Nie udało się zweryfikować notowania. Spróbuj ponownie."
    return StockInstrument(
        ticker=symbol,
        name=quote.get("longname") or quote.get("shortname") or symbol,
        exchange=quote.get("exchDisp") or quote.get("exchange"),
        currency=currency,
        quote_type=quote.get("quoteType"),
        can_transact=issue is None,
        unavailable_reason=issue,
    )


def _normalize_query(query: str) -> str:
    # Unicode decomposition handles Ż/ó/etc.; ł needs an explicit replacement.
    return "".join(
        char
        for char in unicodedata.normalize(
            "NFKD", query.translate(str.maketrans("łŁ", "lL"))
        )
        if not unicodedata.combining(char)
    ).strip()


def search_stocks(query: str, *, crypto: bool = False) -> list[StockInstrument]:
    normalized = _normalize_query(query)
    key = f"{crypto}:{normalized.casefold()}"
    cached = _get(_searches, key)
    if cached is not None:
        return cached
    try:
        quotes = yf.Search(
            normalized,
            max_results=8,
            news_count=0,
            lists_count=0,
            timeout=5,
            raise_errors=True,
        ).quotes
    except Exception as exc:
        logger.exception("Yahoo search failed")
        raise HTTPException(
            503, "Wyszukiwarka Yahoo jest chwilowo niedostępna. Spróbuj ponownie."
        ) from exc
    # Preserve Yahoo ordering and every instrument type, removing duplicate symbols.
    unique = {}
    for quote in quotes:
        if (quote.get("quoteType") == "CRYPTOCURRENCY") != crypto:
            continue
        unique.setdefault(quote["symbol"], quote)
    results = list(_workers.map(_enrich, unique.values()))
    results = [
        result
        for result in results
        if (result.quote_type == "CRYPTOCURRENCY") == crypto
    ]
    # Retry incomplete currency/metadata responses instead of caching them.
    if all(result.unavailable_reason is None for result in results):
        _put(_searches, key, results, ttl=60)
    return results
