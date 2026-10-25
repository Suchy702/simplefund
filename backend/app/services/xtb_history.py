"""Present imports as single history entries and remove their ledger atomically."""

from collections import defaultdict
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    CashTransaction,
    StockTransaction,
    Transaction,
    XtbEvent,
    XtbImport,
)
from app.models.enums import Currency, TransactionType
from app.repositories.stocks import validate_stock_position
from app.schemas.portfolio import Operation
from app.services.xtb_parser import UNIT_ADJUSTMENT

ZERO = Decimal(0)


def history_operations(db: Session, user_id: UUID, rows, rates) -> list[Operation]:
    # Portfolio valuation still consumes the original ledger, never these summaries.
    from app.services.portfolio import operation_from_row

    groups = defaultdict(list)
    ordered = []
    sources = defaultdict(set)
    for transaction, *details in rows:
        if transaction.xtb_import_id is None:
            operation = operation_from_row((transaction, *details), rates)
            ordered.append((operation.date, transaction.created_at, operation))
        else:
            groups[transaction.xtb_import_id].append((transaction, *details))
            if transaction.external_id:
                sources[transaction.xtb_import_id].add(
                    transaction.external_id.removesuffix(":trade")
                )
    for external_id, import_id in db.execute(
        select(XtbEvent.external_id, XtbEvent.xtb_import_id).where(
            XtbEvent.user_id == user_id
        )
    ):
        if import_id is not None:
            sources[import_id].add(external_id)
    batches = db.execute(
        select(
            XtbImport.id, XtbImport.committed_at, XtbImport.payload["accounts"]
        ).where(XtbImport.user_id == user_id, XtbImport.committed_at.is_not(None))
    )
    for import_id, committed_at, accounts in batches:
        if not sources[import_id] and not groups[import_id]:
            continue
        account = accounts[0]
        currency = Currency(account["currency"])
        value: Decimal | None = ZERO
        value_pln: Decimal | None = ZERO
        for row in groups[import_id]:
            transaction = row[0]
            if not transaction.external_flow:
                continue
            operation = operation_from_row(row, rates)
            sign = 1 if transaction.type == TransactionType.buy else -1
            if operation.value is None:
                value = None
            elif value is not None:
                value += sign * operation.value
            if operation.value_pln is None:
                value_pln = None
            elif value_pln is not None:
                value_pln += sign * operation.value_pln
        operation = Operation(
            id=import_id,
            type="import",
            kind="XTB",
            name=account["filename"].removeprefix("Wcześniejszy "),
            qty=None,
            price=None,
            value=value,
            currency=currency,
            date=committed_at.date(),
            value_pln=value_pln,
            source_label="Import XTB",
            operation_count=len(sources[import_id]),
            value_description="Wpłaty minus wypłaty w tym imporcie. "
            "Usunięcie wpisu usuwa wszystkie operacje tego importu.",
        )
        ordered.append((operation.date, committed_at, operation))
    return [
        item[2]
        for item in sorted(
            ordered, key=lambda item: (item[0], item[1], str(item[2].id)), reverse=True
        )
    ]


def delete_import(db: Session, user_id: UUID, import_id: UUID) -> None:
    """Called within the existing transaction and per-user portfolio lock."""
    from app.services.portfolio import validate_cash_changes

    batch = db.scalar(
        select(XtbImport)
        .where(
            XtbImport.id == import_id,
            XtbImport.user_id == user_id,
            XtbImport.committed_at.is_not(None),
        )
        .with_for_update()
    )
    if batch is None:
        raise HTTPException(404, "Nie znaleziono operacji")
    transactions = db.scalars(
        select(Transaction).where(
            Transaction.user_id == user_id, Transaction.xtb_import_id == import_id
        )
    ).all()
    ids = {transaction.id for transaction in transactions}
    source_ids = {
        transaction.external_id.removesuffix(":trade")
        for transaction in transactions
        if transaction.external_id
    }
    source_ids.update(
        db.scalars(
            select(XtbEvent.external_id).where(
                XtbEvent.user_id == user_id, XtbEvent.xtb_import_id == import_id
            )
        )
    )
    removed_cash_sources = [
        transaction.external_id
        for transaction in transactions
        if transaction.external_id and not transaction.external_id.endswith(":trade")
    ]
    if (
        removed_cash_sources
        and db.scalar(
            select(Transaction.id)
            .where(
                Transaction.user_id == user_id,
                Transaction.xtb_import_id != import_id,
                Transaction.external_id.in_(
                    [f"{source}:trade" for source in removed_cash_sources]
                ),
            )
            .limit(1)
        )
        is not None
    ):
        raise HTTPException(
            409,
            "Późniejszy import zawiera transakcje rozliczane przez ten import. "
            "Usuń najpierw ten późniejszy import.",
        )
    stocks = set(
        db.scalars(
            select(StockTransaction.stock_id)
            .join(Transaction)
            .where(
                Transaction.user_id == user_id, Transaction.xtb_import_id == import_id
            )
        )
    )
    # Removing a batch must not strand a later withdrawal or worsen an existing
    # deficit reported by XTB. Compare against the complete original cash ledger.
    daily, changes = (
        defaultdict(lambda: defaultdict(lambda: ZERO)),
        defaultdict(lambda: defaultdict(lambda: ZERO)),
    )
    for transaction, value in db.execute(
        select(Transaction, CashTransaction.value)
        .join(CashTransaction)
        .where(Transaction.user_id == user_id)
    ):
        signed = value if transaction.type == TransactionType.buy else -value
        daily[transaction.currency][transaction.date] += signed
        if transaction.id in ids:
            changes[transaction.currency][transaction.date] -= signed
    for currency, deltas in changes.items():
        validate_cash_changes(
            daily[currency],
            deltas,
            "Import ma zależne operacje gotówkowe. "
            "Usuń najpierw późniejsze zależne operacje.",
        )
    selected = select(Transaction.id).where(
        Transaction.user_id == user_id, Transaction.xtb_import_id == import_id
    )
    for model in (CashTransaction, StockTransaction):
        db.execute(delete(model).where(model.transaction_id.in_(selected)))
    db.execute(
        delete(Transaction).where(
            Transaction.user_id == user_id, Transaction.xtb_import_id == import_id
        )
    )
    try:
        for stock_id in stocks:
            validate_stock_position(db, user_id, stock_id)
    except HTTPException as exc:
        raise HTTPException(
            409,
            "Import ma zależne transakcje instrumentów. "
            "Usuń najpierw późniejsze zależne operacje.",
        ) from exc
    # A unit conversion can leave a positive quantity even after its original
    # purchase is removed. Preserve that cost-basis dependency explicitly.
    remaining_sources = db.scalars(
        select(XtbEvent.payload["source"])
        .join(
            Transaction,
            (Transaction.user_id == XtbEvent.user_id)
            & (Transaction.external_id == XtbEvent.external_id + ":trade"),
        )
        .where(XtbEvent.user_id == user_id)
    ).all()
    original_positions = {
        (source["account"], source["position_id"])
        for source in remaining_sources
        if source["kind"] == "Stock purchase"
    }
    if any(
        source["kind"] == UNIT_ADJUSTMENT
        and (source["account"], source["position_id"]) not in original_positions
        for source in remaining_sources
    ):
        raise HTTPException(
            409,
            "Późniejszy import zawiera zależne przeliczenie jednostek. "
            "Usuń najpierw ten późniejszy import.",
        )
    # A source may have its cash leg in one import and a previously skipped stock
    # leg in a later import. Preserve the remaining leg and its deduplication ID.
    remaining = defaultdict(list)
    if source_ids:
        for transaction in db.scalars(
            select(Transaction).where(
                Transaction.user_id == user_id,
                func.regexp_replace(Transaction.external_id, ":trade$", "").in_(
                    source_ids
                ),
            )
        ):
            if transaction.external_id:
                remaining[transaction.external_id.removesuffix(":trade")].append(
                    transaction
                )
        for event in db.scalars(
            select(XtbEvent).where(
                XtbEvent.user_id == user_id, XtbEvent.external_id.in_(source_ids)
            )
        ):
            legs = remaining[event.external_id]
            if not legs:
                db.delete(event)
                continue
            event.payload = {
                **event.payload,
                "cash_imported": any(t.external_id == event.external_id for t in legs),
                "trade_imported": any(t.external_id.endswith(":trade") for t in legs),
            }
            if event.xtb_import_id == import_id:
                event.xtb_import_id = legs[0].xtb_import_id
    db.flush()
    db.delete(batch)
