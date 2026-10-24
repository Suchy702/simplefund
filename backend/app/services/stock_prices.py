import logging
from datetime import date, datetime, timezone
from threading import Lock
from time import monotonic
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import AssetPrice, Stock, Transaction
from app.models.enums import AssetType, Currency
from app.repositories.portfolio import exchange_rates
from app.repositories.stocks import held_stocks
from app.services.exchange_rates import ExchangeRateHistory
from app.services.frankfurter import fetch_rates, store_rates
from app.services.yahoo import MarketSnapshot, market_snapshot

logger = logging.getLogger(__name__)
_refresh_lock = Lock()
_next_refresh: dict[UUID, float] = {}


def invalidate_user_prices(user_id: UUID) -> None:
    with _refresh_lock:
        _next_refresh.pop(user_id, None)


def store_snapshot(db: Session, stock: Stock, snapshot: MarketSnapshot) -> None:
    if snapshot.instrument.currency != stock.currency.value:
        raise ValueError("Yahoo price currency differs from instrument currency")
    rows = [
        {
            "stock_id": stock.id,
            "price_date": price_date,
            "price": price,
            "currency": Currency(snapshot.instrument.currency),
            "updated_at": datetime.now(timezone.utc),
        }
        for price_date, price in snapshot.prices
    ]
    if not rows:
        return
    statement = insert(AssetPrice).values(rows)
    db.execute(
        statement.on_conflict_do_update(
            index_elements=[AssetPrice.stock_id, AssetPrice.price_date],
            set_={
                "price": statement.excluded.price,
                "currency": statement.excluded.currency,
                "updated_at": statement.excluded.updated_at,
            },
        )
    )


def refresh_user_prices(user_id: UUID) -> None:
    """Refresh held instruments at most every 15 minutes, outside ledger locks."""
    with _refresh_lock:
        now = monotonic()
        if _next_refresh.get(user_id, 0) > now:
            return
        # Bound memory and concurrent duplicate refreshes; retry failures in a minute.
        if len(_next_refresh) >= 1024:
            _next_refresh.clear()
        _next_refresh[user_id] = now + 60
    try:
        with SessionLocal() as db:
            stocks = [
                stock
                for stock in held_stocks(db, user_id)
                if not stock.manual_price_only
            ]
            # Retry missing historical FX too, including fully sold positions.
            historical = list(
                db.execute(
                    select(Transaction.currency, Transaction.date)
                    .where(
                        Transaction.user_id == user_id,
                        Transaction.asset_type == AssetType.stock,
                    )
                    .distinct()
                ).tuples()
            )
            existing_rates = ExchangeRateHistory(exchange_rates(db, historical))
            missing = [
                (currency, on)
                for currency, on in historical
                if existing_rates.on(currency, on)[0] is None
            ]
        requests = missing + [(stock.currency, date.today()) for stock in stocks]
        observations = fetch_rates(requests)
        with SessionLocal.begin() as db:
            store_rates(db, observations)
        all_ok = True
        for stock in stocks:
            try:
                # No database transaction is held while contacting Yahoo.
                snapshot = market_snapshot(stock.ticker)
                with SessionLocal.begin() as db:
                    store_snapshot(db, stock, snapshot)
            except Exception:
                all_ok = False
                logger.warning(
                    "Price refresh failed for %s", stock.ticker, exc_info=True
                )
        if all_ok:
            with _refresh_lock:
                _next_refresh[user_id] = monotonic() + 900
    except Exception:
        # Existing stored prices remain usable if the refresh is unavailable.
        logger.exception("Stock price refresh failed")
