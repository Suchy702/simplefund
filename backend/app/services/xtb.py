"""Stage, resolve and atomically import an authenticated user's XTB reports."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from difflib import SequenceMatcher
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import (
    CashTransaction,
    Profile,
    Stock,
    StockTransaction,
    Transaction,
    XtbEvent,
    XtbImport,
    XtbMapping,
)
from app.models.enums import AssetType, Currency, TransactionType
from app.repositories.stocks import validate_stock_position
from app.schemas.stocks import StockInstrument
from app.schemas.xtb import (
    XtbChoice,
    XtbCommit,
    XtbPreview,
    XtbResolution,
    XtbResult,
    XtbSummary,
)
from app.services.frankfurter import fetch_rates, store_rates
from app.services.stock_prices import store_snapshot
from app.services.xtb_parser import (
    CASH_TYPES,
    POSITION_TYPES,
    UNIT_ADJUSTMENT,
    parse_files,
)
from app.services.yahoo import market_snapshot, search_stocks


def yahoo_symbol(ticker: str) -> str:
    root, _, suffix = ticker.rpartition(".")
    if not root:
        return ticker
    suffix = {"PL": "WA", "UK": "L"}.get(suffix, suffix)
    return f"{root}.{suffix}"


def suggestions(item: tuple[str, dict]) -> tuple[str, dict]:
    ticker, source = item
    expected = yahoo_symbol(ticker)
    candidates = {}
    for query in (expected, source["name"]):
        try:
            for candidate in search_stocks(query):
                if candidate.quote_type in ("ETF", "EQUITY"):
                    candidates[candidate.ticker] = candidate
        except HTTPException:
            pass
        if any(
            c.ticker.upper() == expected and c.can_transact for c in candidates.values()
        ):
            break

    def score(candidate: StockInstrument) -> float:
        exact = candidate.ticker.upper() == expected
        root_match = candidate.ticker.split(".")[0] == ticker.split(".")[0]
        name_match = SequenceMatcher(
            None, source["name"].casefold(), candidate.name.casefold()
        ).ratio()
        category_match = candidate.quote_type == (
            "ETF" if source["category"] == "ETF" else "EQUITY"
        )
        same_exchange = (
            candidate.ticker.rpartition(".")[2] == expected.rpartition(".")[2]
        )
        return (
            0.5 * exact
            + 0.15 * root_match
            + 0.3 * name_match
            + 0.05 * category_match
            + 0.1 * same_exchange
        )

    ranked = sorted(candidates.values(), key=lambda c: (-score(c), c.ticker))
    best = next((c for c in ranked if c.can_transact and score(c) >= 0.25), None)
    return ticker, {
        **source,
        "source_ticker": ticker,
        "candidates": [c.model_dump(mode="json") for c in ranked],
        "selected": best.model_dump(mode="json") if best else None,
        "choice": {"mode": "yahoo", "ticker": best.ticker}
        if best
        else {"mode": "unresolved"},
        "status": "automatic" if best else "unresolved",
        "warning": (
            "Sprawdź zgodność funduszu, giełdy i waluty. "
            "Podobna nazwa nie potwierdza tożsamości."
            if best and best.ticker.upper() != expected
            else None
        ),
    }


def ensure_profile(db: Session, user: dict) -> UUID:
    user_id = UUID(user["sub"])
    if not user.get("email"):
        raise HTTPException(400, "Konto nie ma adresu e-mail")
    db.execute(
        insert(Profile)
        .values(id=user_id, email=user["email"])
        .on_conflict_do_nothing(index_elements=[Profile.id])
    )
    return user_id


def get_stage(db: Session, user_id: UUID, import_id: UUID, lock=False) -> XtbImport:
    query = select(XtbImport).where(
        XtbImport.id == import_id, XtbImport.user_id == user_id
    )
    if lock:
        query = query.with_for_update()
    stage = db.scalar(query)
    if stage is None or stage.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(410, "Podgląd wygasł. Dodaj pliki ponownie.")
    if any(
        info["choice"]["mode"] == "manual"
        for info in stage.payload["instruments"].values()
    ):
        raise HTTPException(
            409,
            "Ten podgląd zawiera wycofaną ręczną wycenę. "
            "Dodaj pliki ponownie i wybierz Yahoo lub pominięcie instrumentu.",
        )
    return stage


def existing_events(db: Session, user_id: UUID) -> dict[str, XtbEvent]:
    return {
        e.external_id: e
        for e in db.scalars(select(XtbEvent).where(XtbEvent.user_id == user_id))
    }


def preview_response(db: Session, stage: XtbImport) -> XtbPreview:
    data = stage.payload
    old = existing_events(db, stage.user_id)
    errors = []
    warnings = list(data["warnings"])
    new, duplicates, skipped, cash_count = 0, 0, 0, 0
    currencies = {a["account"]: a["currency"] for a in data["accounts"]}
    for account, currency in currencies.items():
        if currency is None:
            errors.append(f"Wybierz walutę rachunku {account}.")
    for ticker, instrument in data["instruments"].items():
        mode = instrument["choice"]["mode"]
        if mode == "unresolved":
            errors.append(f"{ticker}: wybierz instrument Yahoo lub pominięcie.")
        if mode != "skip":
            errors.extend(f"{ticker}: {issue}" for issue in instrument["issues"])
    for event in data["events"]:
        previous = old.get(event["external_id"])
        trade = event["kind"] in POSITION_TYPES
        omit = (
            trade and data["instruments"][event["ticker"]]["choice"]["mode"] == "skip"
        )
        cash_missing = Decimal(event["amount"]) != 0 and not (
            previous and previous.payload.get("cash_imported", True)
        )
        skipped += bool(omit)
        if previous and (
            previous.fingerprint != event["fingerprint"]
            or previous.payload["currency"] != currencies[event["account"]]
        ):
            errors.append(
                f"Zmieniona treść lub waluta operacji {event['external_id']}. "
                "Import zatrzymany."
            )
        elif (
            previous
            and not cash_missing
            and (not trade or omit or previous.payload["trade_imported"])
        ):
            duplicates += 1
        else:
            new += 1
        if cash_missing:
            cash_count += 1

    # Reconcile balances per source account, including earlier imported periods.
    combined = {key: e.payload["source"] for key, e in old.items()}
    combined.update({e["external_id"]: e for e in data["events"]})
    daily = {}
    for event in combined.values():
        account = event["account"]
        if account in currencies:
            daily.setdefault(account, {}).setdefault(event["at"][:10], Decimal(0))
            daily[account][event["at"][:10]] += Decimal(event["amount"])
    for account, days in daily.items():
        balance = Decimal(0)
        for when, amount in sorted(days.items()):
            balance += amount
            if balance < 0:
                warnings.append(
                    f"Rachunek {account}: historia XTB wykazuje saldo {balance} "
                    f"{currencies[account] or ''} na {when}. "
                    "Saldo zostanie zachowane zgodnie z raportem."
                )
                break
    current_ids = {e["external_id"] for e in data["events"]}
    for previous in old.values():
        source = previous.payload["source"]
        info = data["instruments"].get(source["ticker"])
        if (
            info
            and info["choice"]["mode"] != "skip"
            and source["kind"] in POSITION_TYPES
            and not previous.payload["trade_imported"]
            and previous.external_id not in current_ids
        ):
            errors.append(
                f"{source['ticker']}: dołącz wcześniejszy raport z pominiętymi "
                "transakcjami, aby odtworzyć całą pozycję."
            )
    # Position summaries are control totals, never additional purchases.
    for account, snapshot in data["snapshots"].items():
        quantities = {}
        for event in combined.values():
            if (
                event["account"] == account
                and event["at"] <= snapshot["at"]
                and event["kind"] in POSITION_TYPES
                and "volume" in event
            ):
                ticker = event["ticker"]
                sign = 1 if POSITION_TYPES[event["kind"]] == "buy" else -1
                quantities[ticker] = quantities.get(
                    ticker, Decimal(0)
                ) + sign * Decimal(event["volume"])
        for ticker in set(quantities) | set(snapshot["positions"]):
            info = data["instruments"].get(ticker)
            if info and info["choice"]["mode"] != "skip" and not info["issues"]:
                expected = Decimal(snapshot["positions"].get(ticker, "0"))
                if quantities.get(ticker, Decimal(0)) != expected:
                    errors.append(
                        f"{account}, {ticker}: historia nie zgadza się z otwartą "
                        "pozycją. Dodaj pełną historię lub pomiń instrument."
                    )
    return XtbPreview(
        import_id=stage.id,
        revision=data["revision"],
        accounts=data["accounts"],
        instruments=list(data["instruments"].values()),
        warnings=sorted(set(warnings)),
        errors=sorted(set(errors)),
        summary=XtbSummary(
            new_operations=new,
            duplicates=duplicates,
            skipped_trades=skipped,
            cash_operations=cash_count,
        ),
        can_import=not errors,
    )


def stage_import(db: Session, user: dict, files: list[tuple[str, bytes]]) -> XtbPreview:
    user_id = UUID(user["sub"])
    with db.begin():
        saved = {
            m.source_ticker: m.choice
            for m in db.scalars(select(XtbMapping).where(XtbMapping.user_id == user_id))
        }
        known = {
            key: event.payload["source"]
            for key, event in existing_events(db, user_id).items()
        }
    data = parse_files(files, known)
    # No open database transaction while Yahoo performs network requests.
    with ThreadPoolExecutor(max_workers=3) as workers:
        instruments = dict(workers.map(suggestions, data["instruments"].items()))
    for ticker, instrument in instruments.items():
        if ticker in saved and saved[ticker]["choice"]["mode"] != "manual":
            instrument["choice"] = saved[ticker]["choice"]
            instrument["selected"] = saved[ticker].get("selected")
            instrument["status"] = "saved"
    data["instruments"] = instruments
    data["revision"] = 1
    with db.begin():
        ensure_profile(db, user)
        db.execute(
            delete(XtbImport).where(
                XtbImport.user_id == user_id,
                XtbImport.expires_at <= datetime.now(timezone.utc),
                XtbImport.committed_at.is_(None),
            )
        )
        stage = XtbImport(
            user_id=user_id,
            payload=data,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
        )
        db.add(stage)
        db.flush()
        return preview_response(db, stage)


def resolve_import(
    db: Session, user: dict, import_id: UUID, request: XtbResolution
) -> XtbPreview:
    user_id = UUID(user["sub"])
    with db.begin():
        data = deepcopy(get_stage(db, user_id, import_id).payload)
    if set(request.choices) != set(data["instruments"]):
        raise HTTPException(422, "Prześlij wybór dla każdego instrumentu.")
    if set(request.currencies) != {a["account"] for a in data["accounts"]}:
        raise HTTPException(422, "Wybierz waluty wszystkich rachunków.")
    for ticker, choice in request.choices.items():
        instrument = data["instruments"][ticker]
        selected = None
        if choice.mode == "yahoo":
            if not choice.ticker:
                raise HTTPException(422, f"{ticker}: wybierz symbol Yahoo.")
            snapshot = verified_snapshot(choice.ticker)
            selected = snapshot.instrument.model_dump(mode="json")
        updated = choice.model_dump(mode="json")
        if (
            XtbChoice.model_validate(instrument["choice"]).model_dump(mode="json")
            != updated
        ):
            instrument["status"] = "changed"
        instrument["choice"], instrument["selected"] = updated, selected
    for account in data["accounts"]:
        account["currency"] = (
            "PLN"
            if account.get("is_ike")
            else request.currencies[account["account"]].value
        )
    with db.begin():
        stage = get_stage(db, user_id, import_id, lock=True)
        if stage.payload["revision"] != request.revision:
            raise HTTPException(409, "Podgląd został zmieniony. Dodaj pliki ponownie.")
        data["revision"] = request.revision + 1
        stage.payload = data
        return preview_response(db, stage)


def verified_snapshot(ticker):
    try:
        snapshot = market_snapshot(ticker)
    except Exception as exc:
        raise HTTPException(
            422,
            f"Nie można zweryfikować {ticker} w Yahoo. "
            "Wybierz inny instrument lub pomiń go.",
        ) from exc
    if not snapshot.instrument.can_transact or snapshot.instrument.quote_type not in (
        "ETF",
        "EQUITY",
    ):
        raise HTTPException(
            422, f"{ticker}: nieobsługiwana waluta lub rodzaj instrumentu Yahoo."
        )
    return snapshot


def resolve_stock(db: Session, ticker: str, info: dict, snapshots) -> Stock:
    choice = XtbChoice.model_validate(info["choice"])
    if choice.mode != "yahoo" or not choice.ticker:
        raise HTTPException(422, f"{ticker}: wybierz instrument Yahoo lub pominięcie.")
    snapshot = snapshots[choice.ticker]
    instrument = snapshot.instrument
    currency = Currency(instrument.currency)
    db.execute(
        insert(Stock)
        .values(
            ticker=instrument.ticker,
            name=instrument.name,
            currency=currency,
            exchange=instrument.exchange,
            quote_type=instrument.quote_type,
            manual_price_only=False,
        )
        .on_conflict_do_nothing(index_elements=[Stock.ticker])
    )
    stock = db.scalar(select(Stock).where(Stock.ticker == instrument.ticker))
    if stock is None or stock.currency != currency or stock.manual_price_only:
        raise HTTPException(
            409, f"{ticker}: zapisany instrument nie ma zgodnego notowania Yahoo."
        )
    store_snapshot(db, stock, snapshot)
    return stock


def commit_import(db: Session, user: dict, request: XtbCommit) -> XtbResult:
    user_id = UUID(user["sub"])
    with db.begin():
        stage = get_stage(db, user_id, request.import_id)
        data = deepcopy(stage.payload)
        initial = preview_response(db, stage)
        if data["revision"] != request.revision or not initial.can_import:
            raise HTTPException(
                409, "Podgląd wymaga poprawy lub ponownego zatwierdzenia."
            )
    snapshots = {}
    for instrument in data["instruments"].values():
        choice = instrument["choice"]
        if choice["mode"] == "yahoo" and choice["ticker"] not in snapshots:
            snapshot = verified_snapshot(choice["ticker"])
            if snapshot.instrument.currency != instrument["selected"]["currency"]:
                raise HTTPException(
                    409, "Zmieniła się waluta Yahoo. Przeanalizuj pliki ponownie."
                )
            snapshots[choice["ticker"]] = snapshot
    currencies = {a["account"]: Currency(a["currency"]) for a in data["accounts"]}
    observations = fetch_rates(
        [
            (currencies[e["account"]], datetime.fromisoformat(e["at"]).date())
            for e in data["events"]
        ]
        + [(Currency(s.instrument.currency), date.today()) for s in snapshots.values()]
    )
    with db.begin():
        ensure_profile(db, user)
        # Serialize with manual creation/deletion and other imports for this user.
        db.execute(select(Profile.id).where(Profile.id == user_id).with_for_update())
        stage = get_stage(db, user_id, request.import_id, lock=True)
        if stage.payload["revision"] != request.revision:
            raise HTTPException(409, "Podgląd został zmieniony. Zatwierdź go ponownie.")
        current = preview_response(db, stage)
        if not current.can_import:
            raise HTTPException(
                409, "Historia zmieniła się od podglądu. Przeanalizuj pliki ponownie."
            )
        old = existing_events(db, user_id)
        if len(data["accounts"]) != 1:
            raise HTTPException(409, "Przeanalizuj ponownie jeden plik XLSX.")
        stocks: dict[str, Stock] = {}
        affected: set[UUID] = set()
        for ticker, instrument in data["instruments"].items():
            statement = insert(XtbMapping).values(
                user_id=user_id,
                source_ticker=ticker,
                choice={
                    "choice": instrument["choice"],
                    "selected": instrument["selected"],
                },
            )
            db.execute(
                statement.on_conflict_do_update(
                    index_elements=[XtbMapping.user_id, XtbMapping.source_ticker],
                    set_={"choice": statement.excluded.choice},
                )
            )
            if instrument["choice"]["mode"] == "skip":
                continue
            stock = resolve_stock(db, ticker, instrument, snapshots)
            stocks[ticker] = stock
            affected.add(stock.id)
            # Remapping moves this user's existing trades, never their identities.
            ids = [
                f"{e.external_id}:trade"
                for e in old.values()
                if e.payload["source"]["ticker"] == ticker
                and e.payload["trade_imported"]
            ]
            if ids:
                trades = db.scalars(
                    select(StockTransaction)
                    .join(Transaction)
                    .where(
                        Transaction.user_id == user_id, Transaction.external_id.in_(ids)
                    )
                ).all()
                for trade in trades:
                    affected.add(trade.stock_id)
                    trade.stock_id = stock.id
        imported = 0
        for event in data["events"]:
            previous = old.get(event["external_id"])
            trade = event["kind"] in POSITION_TYPES
            stock = stocks.get(event["ticker"]) if trade else None
            trade_imported = bool(previous and previous.payload["trade_imported"])
            amount, currency = Decimal(event["amount"]), currencies[event["account"]]
            at = datetime.fromisoformat(event["at"])
            cash_imported = bool(
                previous and previous.payload.get("cash_imported", True)
            )
            changed = previous is None
            if amount and not cash_imported:
                label, external_flow = CASH_TYPES.get(
                    event["kind"],
                    (
                        "Rozliczenie zakupu XTB"
                        if amount < 0
                        else "Rozliczenie sprzedaży XTB",
                        False,
                    ),
                )
                cash_tx = Transaction(
                    user_id=user_id,
                    xtb_import_id=stage.id,
                    external_id=event["external_id"],
                    type=TransactionType.buy if amount > 0 else TransactionType.sell,
                    asset_type=AssetType.cash,
                    date=at.date(),
                    created_at=at,
                    currency=currency,
                    external_flow=external_flow,
                    source_label=label,
                )
                db.add(cash_tx)
                db.flush()
                db.add(CashTransaction(transaction_id=cash_tx.id, value=abs(amount)))
                cash_imported = True
                changed = True
            if stock is not None and not trade_imported:
                volume = Decimal(event["volume"])
                unit_price = (abs(amount) / volume).quantize(Decimal("0.0001"))
                adjustment = event["kind"] == UNIT_ADJUSTMENT
                if (not adjustment and unit_price <= 0) or unit_price >= Decimal(
                    "100000000000000"
                ):
                    raise HTTPException(
                        422, f"Cena poza zakresem: {event['external_id']}"
                    )
                trade_tx = Transaction(
                    user_id=user_id,
                    xtb_import_id=stage.id,
                    external_id=f"{event['external_id']}:trade",
                    type=TransactionType(POSITION_TYPES[event["kind"]]),
                    asset_type=AssetType.stock,
                    date=at.date(),
                    created_at=at,
                    currency=currency,
                    external_flow=False,
                    source_label=(
                        f"Przeliczenie jednostek XTB {event['ratio']}:1"
                        if adjustment
                        else "Zakup XTB"
                        if amount < 0
                        else "Sprzedaż XTB"
                    ),
                )
                db.add(trade_tx)
                db.flush()
                db.add(
                    StockTransaction(
                        transaction_id=trade_tx.id,
                        stock_id=stock.id,
                        volume=volume,
                        price_per_unit=unit_price,
                        total_value=abs(amount),
                    )
                )
                trade_imported = True
                changed = True
            imported += int(changed)
            payload = {
                "source": event,
                "currency": currency.value,
                "trade_imported": trade_imported,
                "cash_imported": cash_imported,
            }
            if previous:
                previous.payload = payload
            else:
                db.add(
                    XtbEvent(
                        user_id=user_id,
                        external_id=event["external_id"],
                        fingerprint=event["fingerprint"],
                        xtb_import_id=stage.id,
                        payload=payload,
                    )
                )
        if imported and stage.committed_at is None:
            stage.committed_at = datetime.now(timezone.utc)
        db.flush()
        for stock_id in sorted(affected, key=lambda value: value.hex):
            validate_stock_position(db, user_id, stock_id)
        store_rates(db, observations)
        # Retain the preview for safe retries after a lost HTTP response.
        return XtbResult(
            imported=imported,
            duplicates=current.summary.duplicates,
            skipped_trades=current.summary.skipped_trades,
        )
