import hashlib
import json
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ManualPrice, PortfolioHistory, Profile
from app.models.metals import GRAMS_PER_TROY_OUNCE, METALS_BY_TICKER
from app.repositories.portfolio import transaction_rows
from app.schemas.portfolio import PortfolioPoint, PortfolioRange
from app.schemas.portfolio_history import HistoryResponse
from app.schemas.stocks import StockInstrument
from app.services.history_sources import HistoryDataError, source_history
from app.services.portfolio_statistics import (
    calculate_portfolio_statistics,
    performance_statistics,
    range_start,
)
from app.services.stock_prices import store_snapshot
from app.services.yahoo import MarketSnapshot

logger = logging.getLogger(__name__)
COOLDOWN = timedelta(minutes=5)
LEASE = timedelta(minutes=5)
RANGES: tuple[PortfolioRange, ...] = ("1M", "3M", "6M", "1R", "MAX")
INCOMPLETE_HISTORY_WARNING = (
    "Brak wyceny części aktywów lub kursów walut. "
    "Wykres pokazuje przerwy; statystyki niepełnego okresu "
    "są niedostępne."
)


class HistoryCancelled(Exception):
    pass


def ledger_fingerprint(db: Session, user_id: UUID) -> str:
    """Detect ledger and private-price edits without changing transaction writers."""
    records = []
    for row in transaction_rows(db, user_id):
        records.append(
            [
                {
                    column.key: str(getattr(item, column.key))
                    for column in item.__table__.columns
                }
                if item is not None
                else None
                for item in row
            ]
        )
    prices = db.scalars(
        select(ManualPrice)
        .where(ManualPrice.user_id == user_id, ManualPrice.price_date <= date.today())
        .order_by(ManualPrice.id)
    ).all()
    records.extend(
        {
            column.key: str(getattr(price, column.key))
            for column in price.__table__.columns
        }
        for price in prices
    )
    return hashlib.sha256(json.dumps(records, sort_keys=True).encode()).hexdigest()


def get_history(
    db: Session, user_id: UUID, selected_range: PortfolioRange = "1R"
) -> HistoryResponse:
    now = datetime.now(timezone.utc)
    entry = db.get(PortfolioHistory, user_id)
    profile = db.get(Profile, user_id)
    if entry is None:
        return HistoryResponse(server_time=now, range=selected_range)
    if entry.status == "running" and (
        entry.heartbeat_at is None or entry.heartbeat_at < now - LEASE
    ):
        db.execute(
            update(PortfolioHistory)
            .where(
                PortfolioHistory.user_id == user_id,
                PortfolioHistory.job_id == entry.job_id,
                or_(
                    PortfolioHistory.heartbeat_at.is_(None),
                    PortfolioHistory.heartbeat_at < now - LEASE,
                ),
                PortfolioHistory.status == "running",
            )
            .values(
                status="error",
                error="Obliczanie zostało przerwane. Uruchom je ponownie.",
            )
        )
        db.commit()
        db.refresh(entry)
    payload = entry.payload or {}
    cutoff = range_start(
        date.fromisoformat(payload.get("asOfDate", date.today().isoformat())),
        selected_range,
    )
    series = [
        PortfolioPoint.model_validate({**point, "benchmark": None})
        for point in payload.get("series", [])
        if point["date"] >= cutoff.isoformat()
    ]
    # Older snapshots can contain comparison-only warnings. Expose only the
    # completeness of the portfolio and contributions while comparisons are off.
    warnings = (
        [INCOMPLETE_HISTORY_WARNING]
        if any(point.value is None or point.contribution is None for point in series)
        else []
    )
    return HistoryResponse(
        status=entry.status,
        server_time=now,
        calculated_at=entry.calculated_at,
        next_calculation_at=(
            entry.requested_at + COOLDOWN
            if entry.requested_at and (profile is None or profile.role != "admin")
            else None
        ),
        stale=bool(payload)
        and (
            payload.get("asOfDate") != date.today().isoformat()
            or payload.get("fingerprint") != ledger_fingerprint(db, user_id)
        ),
        error=entry.error,
        warnings=warnings,
        benchmark=None,
        range=selected_range,
        series=series,
        performance=payload.get("performance", {}).get(selected_range),
    )


def request_history(db: Session, user: dict) -> UUID:
    user_id = UUID(user["sub"])
    if not user.get("email"):
        raise HTTPException(400, "Konto nie ma adresu e-mail.")
    now = datetime.now(timezone.utc)
    with db.begin():
        db.execute(
            insert(Profile)
            .values(id=user_id, email=user["email"])
            .on_conflict_do_nothing()
        )
        # Same user lock as ledger edits, held only while reserving the job.
        profile = db.scalars(
            select(Profile).where(Profile.id == user_id).with_for_update()
        ).one()
        entry = db.get(PortfolioHistory, user_id)
        if entry is not None:
            if (
                entry.status == "running"
                and entry.heartbeat_at is not None
                and entry.heartbeat_at >= now - LEASE
            ):
                raise HTTPException(409, "Obliczanie historii już trwa.")
            if (
                profile.role != "admin"
                and entry.requested_at
                and now < entry.requested_at + COOLDOWN
            ):
                seconds = int((entry.requested_at + COOLDOWN - now).total_seconds()) + 1
                raise HTTPException(
                    429,
                    f"Historię można przeliczać co 5 minut. Spróbuj za {seconds} s.",
                    headers={"Retry-After": str(seconds)},
                )
        else:
            entry = PortfolioHistory(user_id=user_id)
            db.add(entry)
        job_id = uuid4()
        entry.job_id = job_id
        entry.status = "running"
        entry.requested_at = now
        entry.heartbeat_at = now
        entry.error = None
    return job_id


def _heartbeat(user_id: UUID, job_id: UUID) -> None:
    with SessionLocal.begin() as db:
        claimed_user = db.scalar(
            update(PortfolioHistory)
            .where(
                PortfolioHistory.user_id == user_id,
                PortfolioHistory.job_id == job_id,
                PortfolioHistory.status == "running",
            )
            .values(heartbeat_at=datetime.now(timezone.utc))
            .returning(PortfolioHistory.user_id)
        )
        if claimed_user is None:
            raise HistoryCancelled()


def calculate_history(user_id: UUID, job_id: UUID) -> None:
    """Publish atomically after the response; retain old data on failure."""

    def heartbeat():
        _heartbeat(user_id, job_id)

    try:
        heartbeat()
        with SessionLocal() as db:
            rows = transaction_rows(db, user_id)
            fingerprint = ledger_fingerprint(db, user_id)
            stocks = {row[3].id: row[3] for row in rows if row[3] is not None}
            start = min((row[0].date for row in rows), default=date.today())
            first_trade: dict[UUID, date] = {}
            for transaction, _, trade, _, _, _ in rows:
                if trade is not None:
                    first_trade.setdefault(trade.stock_id, transaction.date)
        source_end = datetime.now(timezone.utc).date() - timedelta(days=1)
        splits = {}
        for stock in stocks.values():
            if stock.manual_price_only:
                continue
            metal = METALS_BY_TICKER.get(stock.ticker)
            source = source_history(
                f"yahoo:{metal.yahoo_symbol if metal else stock.ticker}",
                first_trade[stock.id]
                - timedelta(days=min(14, first_trade[stock.id].toordinal() - 1)),
                source_end,
                heartbeat,
            )
            if source["currency"] != stock.currency.value or (
                metal and source["quoteType"] != "FUTURE"
            ):
                raise HistoryDataError(
                    "Waluta lub typ historii Yahoo nie pasuje do instrumentu "
                    f"{stock.ticker}."
                )
            prices = tuple(
                (
                    date.fromisoformat(on),
                    (Decimal(price) / GRAMS_PER_TROY_OUNCE).quantize(Decimal("0.0001"))
                    if metal
                    else Decimal(price),
                )
                for on, price in source["observations"].items()
            )
            snapshot = MarketSnapshot(
                StockInstrument(
                    ticker=stock.ticker,
                    name=stock.name,
                    currency=stock.currency.value,
                    quote_type=stock.quote_type,
                    can_transact=True,
                ),
                prices,
            )
            with SessionLocal.begin() as db:
                store_snapshot(db, stock, snapshot)
            if not metal:
                splits[stock.id] = source.get("splits", {})
        # Chart calculations only read FX observations already stored in the DB.
        # Missing rates remain unavailable; this job never contacts Frankfurter.
        heartbeat()
        with SessionLocal() as db:
            statistics = calculate_portfolio_statistics(
                db,
                user_id,
                "MAX",
                on_progress=heartbeat,
                split_events=splits,
                closed_prices_only=True,
            )
        warnings = []
        if any(
            point.value is None or point.contribution is None
            for point in statistics.series
        ):
            warnings.append(INCOMPLETE_HISTORY_WARNING)
        performance = {}
        for selected_range in RANGES:
            cutoff = range_start(statistics.kpi.as_of_date, selected_range)
            points = [point for point in statistics.series if point.date >= cutoff]
            daily_returns = [point.daily_return for point in points]
            if points and points[0].date == start:
                daily_returns = daily_returns[1:]
            summary = performance_statistics(points, daily_returns)
            performance[selected_range] = (
                summary.model_dump(mode="json", by_alias=True) if summary else None
            )
        payload = {
            "fingerprint": fingerprint,
            "asOfDate": statistics.kpi.as_of_date.isoformat(),
            "series": [
                point.model_dump(mode="json", by_alias=True)
                for point in statistics.series
            ],
            "performance": performance,
            "warnings": warnings,
            "benchmark": None,
        }
        heartbeat()
        with SessionLocal.begin() as db:
            db.execute(
                update(PortfolioHistory)
                .where(
                    PortfolioHistory.user_id == user_id,
                    PortfolioHistory.job_id == job_id,
                    PortfolioHistory.status == "running",
                )
                .values(
                    status="ready",
                    payload=payload,
                    calculated_at=datetime.now(timezone.utc),
                    error=None,
                )
            )
    except HistoryCancelled:
        return
    except Exception as exc:
        logger.exception("Portfolio history failed for job %s", job_id)
        message = (
            str(exc)
            if isinstance(exc, HistoryDataError)
            else "Nie udało się obliczyć historii. "
            "Poprzedni wynik pozostaje dostępny. Spróbuj ponownie."
        )
        with SessionLocal.begin() as db:
            db.execute(
                update(PortfolioHistory)
                .where(
                    PortfolioHistory.user_id == user_id,
                    PortfolioHistory.job_id == job_id,
                    PortfolioHistory.status == "running",
                )
                .values(status="error", error=message[:500])
            )
