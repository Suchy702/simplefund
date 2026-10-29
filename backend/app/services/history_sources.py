"""Persistent public history with cross-process request coalescing.

Short database transactions claim leases; network I/O never holds database locks.
Checked request ranges include non-trading days, so weekends are not downloaded
repeatedly. They are distinct from the actual available observation dates.
"""

import json
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from time import sleep
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

import yfinance as yf
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.database import SessionLocal
from app.models import HistorySourceCache
from app.models.enums import Currency

logger = logging.getLogger(__name__)
ZERO = Decimal(0)


class HistoryDataError(Exception):
    """A safe, user-visible source failure; retain the previous portfolio result."""


def _observation_range(payload: dict) -> dict:
    """Separate available observations from the checked request span."""
    dates = payload.get("observations", {})
    return {
        **payload,
        "availableFrom": min(dates) if dates else None,
        "availableTo": max(dates) if dates else None,
        "observationCount": len(dates),
    }


def fetch_yahoo_history(symbol: str, start: date, end: date) -> dict:
    ticker = yf.Ticker(symbol)
    history = ticker.history(
        start=start.isoformat(),
        end=(end + timedelta(days=1)).isoformat(),
        interval="1d",
        auto_adjust=False,
        actions=True,
        repair=False,
        timeout=15,
        raise_errors=True,
    )
    metadata = ticker.get_history_metadata()
    canonical = metadata.get("symbol")
    currency = metadata.get("currency")
    if (
        not isinstance(canonical, str)
        or canonical.upper() != symbol.upper()
        or currency not in Currency.__members__
    ):
        raise ValueError("Invalid Yahoo symbol or unsupported price currency")
    crypto = metadata.get("instrumentType") == "CRYPTOCURRENCY"
    observations, splits = {}, {}
    for timestamp, row in history.iterrows():
        on = timestamp.date()
        # Historical charts only use completed daily candles.
        if not start <= on <= end or on >= datetime.now(timezone.utc).date():
            continue
        price = Decimal(str(row["Close"]))
        precision = Decimal("0.000000000001") if crypto else Decimal("0.0001")
        if price.is_finite() and ZERO < price < Decimal("100000000000000"):
            rounded = price.quantize(precision)
            if rounded > ZERO:
                observations[on.isoformat()] = str(rounded)
        split = Decimal(str(row.get("Stock Splits", 0)))
        if split.is_finite() and split > ZERO:
            splits[on.isoformat()] = str(split)
    return {
        "ticker": canonical,
        "name": metadata.get("longName") or metadata.get("shortName") or canonical,
        "currency": currency,
        "quoteType": metadata.get("instrumentType"),
        "observations": observations,
        "splits": splits,
    }


def fetch_fx_history(currency: str, start: date, end: date) -> dict:
    params = urlencode({"base": currency, "quotes": "PLN", "from": start, "to": end})
    request = Request(
        f"https://api.frankfurter.dev/v2/rates?{params}",
        headers={"User-Agent": "SimpleFund/1.0", "Accept": "application/json"},
    )
    with urlopen(request, timeout=20) as response:
        rows = json.load(response, parse_float=Decimal)
    if not isinstance(rows, list):
        raise ValueError("Invalid Frankfurter time series")
    observations = {}
    for row in rows:
        observed = date.fromisoformat(row["date"])
        rate = Decimal(str(row["rate"]))
        if (
            row.get("base") != currency
            or row.get("quote") != "PLN"
            or not start <= observed <= end
            or not rate.is_finite()
            or not ZERO < rate < Decimal("1000000000000")
        ):
            raise ValueError("Invalid Frankfurter observation")
        rounded = rate.quantize(Decimal("0.000001"))
        if rounded <= ZERO:
            raise ValueError("Frankfurter rate is below stored precision")
        observations[observed.isoformat()] = str(rounded)
    return {"currency": currency, "observations": observations, "splits": {}}


def source_history(key: str, start: date, end: date, heartbeat) -> dict:
    """Fetch unchecked intervals, retaining partial responses without inventing data."""
    waiting_until = datetime.now(timezone.utc) + timedelta(minutes=3)
    while True:
        heartbeat()
        now = datetime.now(timezone.utc)
        lease = uuid4()
        wait = False
        with SessionLocal.begin() as db:
            db.execute(
                insert(HistorySourceCache).values(key=key).on_conflict_do_nothing()
            )
            entry = db.scalars(
                select(HistorySourceCache)
                .where(HistorySourceCache.key == key)
                .with_for_update()
            ).one()
            payload = entry.payload or {}
            first = (
                date.fromisoformat(payload.get("requestedFrom") or payload["from"])
                if payload
                else None
            )
            last = (
                date.fromisoformat(payload.get("requestedTo") or payload["to"])
                if payload
                else None
            )
            if (
                first is not None
                and last is not None
                and first <= start
                and last >= end
            ):
                return _observation_range(payload)
            if entry.retry_after is not None and entry.retry_after > now:
                raise HistoryDataError(
                    entry.error or "Źródło danych jest chwilowo niedostępne."
                )
            if entry.busy_until is not None and entry.busy_until > now:
                wait = True
            else:
                entry.lease_id = lease
                entry.busy_until = now + timedelta(minutes=2)
                if first is None or last is None:
                    fetch_start, fetch_end = start, end
                elif start < first:
                    # Yahoo Close is split-adjusted. A full backfill keeps all
                    # observations on one adjustment basis when extending left.
                    fetch_start, fetch_end = start, end
                    if key.startswith("fx:"):
                        fetch_end = first - timedelta(days=1)
                else:
                    fetch_start, fetch_end = last + timedelta(days=1), end
                    if key.startswith("yahoo:"):
                        # Include known sessions so weekend/holiday-only tails
                        # still yield a valid Yahoo response. Refresh late bars.
                        fetch_start = max(first, last - timedelta(days=14))
                # Bound response size for FX without making one request per day.
                if key.startswith("fx:"):
                    if first is not None and start < first:
                        fetch_start = max(fetch_start, fetch_end - timedelta(days=1825))
                    else:
                        fetch_end = min(fetch_end, fetch_start + timedelta(days=1825))
        if wait:
            if now >= waiting_until:
                raise HistoryDataError(
                    "Trwa pobieranie wspólnych notowań. Spróbuj ponownie później."
                )
            sleep(2)
            continue
        try:
            fetched = (
                fetch_fx_history(key[3:], fetch_start, fetch_end)
                if key.startswith("fx:")
                else fetch_yahoo_history(key[6:], fetch_start, fetch_end)
            )
            new_splits = set(fetched.get("splits", {})) - set(payload.get("splits", {}))
            if key.startswith("yahoo:") and first is not None and new_splits:
                # A new split also changes historical Yahoo Close values.
                # Refresh that instrument once, only when such an event appears.
                fetch_start = min(first, fetch_start)
                fetched = fetch_yahoo_history(key[6:], fetch_start, fetch_end)
            if payload and fetched["currency"] != payload["currency"]:
                raise ValueError("History source changed its quote currency")
            merged = dict(fetched)
            merged["observations"] = {
                **payload.get("observations", {}),
                **fetched["observations"],
            }
            merged["splits"] = {
                **payload.get("splits", {}),
                **fetched.get("splits", {}),
            }
            merged["requestedFrom"] = min(first or fetch_start, fetch_start).isoformat()
            merged["requestedTo"] = max(last or fetch_end, fetch_end).isoformat()
            merged = _observation_range(merged)
            with SessionLocal.begin() as db:
                entry = db.scalars(
                    select(HistorySourceCache)
                    .where(HistorySourceCache.key == key)
                    .with_for_update()
                ).one()
                if entry.lease_id != lease:
                    raise HistoryDataError(
                        "Pobieranie historii zostało przerwane. Spróbuj ponownie."
                    )
                entry.payload = merged
                entry.busy_until = None
                entry.lease_id = None
                entry.retry_after = None
                entry.error = None
        except Exception as exc:
            logger.warning("History fetch failed for %s", key, exc_info=True)
            message = (
                f"Nie udało się pobrać historii {key}. "
                "Ponowienie pobrania możliwe za 15 minut."
            )
            with SessionLocal.begin() as db:
                entry = db.get(HistorySourceCache, key, with_for_update=True)
                if entry is not None and entry.lease_id == lease:
                    entry.busy_until = None
                    entry.lease_id = None
                    entry.retry_after = datetime.now(timezone.utc) + timedelta(
                        minutes=15
                    )
                    entry.error = message
            raise HistoryDataError(message) from exc
