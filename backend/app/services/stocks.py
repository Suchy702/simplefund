from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Profile, Stock, StockTransaction, Transaction
from app.models.enums import AssetType, Currency, TransactionType
from app.models.metals import METALS_BY_TICKER
from app.repositories.portfolio import exchange_rates
from app.repositories.stocks import held_stocks, validate_stock_position
from app.schemas.portfolio import Operation
from app.schemas.stocks import StockInstrument, StockOperationCreate
from app.services.exchange_rates import ExchangeRateHistory
from app.services.frankfurter import fetch_rates, store_rates
from app.services.portfolio import operation_from_row
from app.services.stock_prices import store_snapshot
from app.services.yahoo import MarketSnapshot, market_snapshot


def list_held_stocks(
    db: Session, user_id: UUID, *, crypto: bool = False
) -> list[StockInstrument]:
    return [
        StockInstrument(
            ticker=stock.ticker,
            name=stock.name,
            exchange=stock.exchange,
            currency=stock.currency.value,
            quote_type=stock.quote_type,
            can_transact=True,
        )
        for stock in held_stocks(db, user_id)
        if stock.quote_type != "METAL"
        and (stock.quote_type == "CRYPTOCURRENCY") == crypto
    ]


def create_stock_operation(
    db: Session, user: dict, data: StockOperationCreate, *, crypto: bool = False
) -> Operation:
    if not user.get("email"):
        raise HTTPException(400, "Konto nie ma adresu e-mail")
    if data.ticker.upper() in METALS_BY_TICKER:
        raise HTTPException(422, "Dodaj kruszec przez formularz Kruszce")
    # Resolve existing instruments first so trades remain possible during Yahoo outages.
    with db.begin():
        known = db.scalar(select(Stock).where(Stock.ticker == data.ticker))
    snapshot = None
    if known is None:
        try:
            snapshot = market_snapshot(data.ticker)
        except Exception as exc:
            raise HTTPException(
                503, "Nie udało się zweryfikować instrumentu w Yahoo. Spróbuj ponownie."
            ) from exc
        if not snapshot.instrument.can_transact:
            raise HTTPException(422, snapshot.instrument.unavailable_reason)
        currency = Currency(snapshot.instrument.currency)
        instrument = snapshot.instrument
    else:
        currency = known.currency
        instrument = StockInstrument(
            ticker=known.ticker,
            name=known.name,
            exchange=known.exchange,
            quote_type=known.quote_type,
            currency=known.currency.value,
            can_transact=True,
        )
    if (instrument.quote_type == "CRYPTOCURRENCY") != crypto:
        raise HTTPException(
            422,
            "Wybierz kryptowalutę z Yahoo Finance."
            if crypto
            else "Dodaj kryptowalutę przez formularz Kryptowaluty.",
        )
    return create_instrument_operation(
        db,
        user,
        data,
        instrument,
        currency,
        snapshot,
        AssetType.crypto if crypto else AssetType.stock,
    )


def create_instrument_operation(
    db: Session,
    user: dict,
    data: StockOperationCreate,
    instrument: StockInstrument,
    currency: Currency,
    snapshot: MarketSnapshot | None = None,
    asset_type: AssetType = AssetType.stock,
) -> Operation:
    """Persist a priced instrument trade using the shared position ledger."""
    user_id = UUID(user["sub"])
    if not user.get("email"):
        raise HTTPException(400, "Konto nie ma adresu e-mail")
    observations = fetch_rates(
        [
            (currency, data.date),
            (currency, date.today()),
            (Currency(instrument.currency), date.today()),
        ]
    )

    with db.begin():
        db.execute(
            insert(Profile)
            .values(id=user_id, email=user["email"])
            .on_conflict_do_nothing(index_elements=[Profile.id])
        )
        # Match deletion's user lock to serialize changes to the entire position ledger.
        db.execute(select(Profile.id).where(Profile.id == user_id).with_for_update())
        db.execute(
            insert(Stock)
            .values(
                ticker=instrument.ticker,
                name=instrument.name,
                exchange=instrument.exchange,
                quote_type=instrument.quote_type,
                currency=Currency(instrument.currency),
            )
            .on_conflict_do_nothing(index_elements=[Stock.ticker])
        )
        stock = db.scalar(select(Stock).where(Stock.ticker == instrument.ticker))
        if stock is None:
            raise HTTPException(404, "Nie znaleziono instrumentu")
        transaction = Transaction(
            user_id=user_id,
            type=TransactionType(data.operation_type),
            asset_type=asset_type,
            date=data.date,
            currency=currency,
            # Record ordering after acquiring the ledger lock, including same-day edits.
            created_at=datetime.now(timezone.utc),
        )
        db.add(transaction)
        db.flush()
        trade = StockTransaction(
            transaction_id=transaction.id,
            stock_id=stock.id,
            volume=data.volume,
            price_per_unit=data.price_per_unit,
        )
        db.add(trade)
        db.flush()
        validate_stock_position(
            db, user_id, stock.id, currency if asset_type == AssetType.metal else None
        )
        if snapshot is not None:
            store_snapshot(db, stock, snapshot)
        store_rates(db, observations)
        return operation_from_row(
            (transaction, None, trade, stock, None, None),
            ExchangeRateHistory(exchange_rates(db, [(currency, data.date)])),
        )
