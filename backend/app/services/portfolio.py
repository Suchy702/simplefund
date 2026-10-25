from collections import defaultdict
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import (
    BondTransaction,
    CashTransaction,
    DepositTransaction,
    Profile,
    StockTransaction,
    Transaction,
)
from app.models.enums import AssetType, TransactionType
from app.models.metals import METALS_BY_TICKER
from app.repositories.portfolio import (
    bond_valuation_sources,
    exchange_rates,
    stock_prices,
    transaction_rows,
)
from app.repositories.stocks import validate_stock_position
from app.schemas.portfolio import (
    AllocationSegment,
    CashOperationCreate,
    DepositOperationCreate,
    Holding,
    HoldingIncomePayment,
    Operation,
    PortfolioAllocation,
)
from app.services.bond_valuation import BondValuationError, BondValuator
from app.services.exchange_rates import ExchangeRateHistory, exchange_rate_on

ZERO = Decimal(0)
ONE = Decimal(1)

ALLOCATION_CLASSES = {
    "Akcje": "var(--cat-1)",
    "Lokata": "var(--cat-2)",
    "Depozyt": "oklch(65% 0.13 30)",
    "Gotówka": "var(--cat-3)",
    "Obligacje skarbowe": "var(--cat-4)",
    "Kruszce": "oklch(68% 0.13 90)",
    "Kryptowaluty": "oklch(67% 0.17 55)",
}


def portfolio_allocation(db: Session, user_id: UUID) -> PortfolioAllocation:
    return allocation_from_holdings(list_holdings(db, user_id))


def allocation_from_holdings(holdings: list[Holding]) -> PortfolioAllocation:
    grouped = defaultdict(list)
    for holding in holdings:
        if holding.value is not None and holding.value > ZERO:
            grouped[holding.asset_class].append(holding)
    total = sum((h.value for group in grouped.values() for h in group), start=ZERO)
    outer, inner = [], []
    class_order = {name: index for index, name in enumerate(ALLOCATION_CLASSES)}
    for name in sorted(grouped, key=lambda name: (class_order.get(name, 99), name)):
        group = sorted(grouped[name], key=lambda h: (-h.value, h.id))
        color = ALLOCATION_CLASSES.get(name, "var(--cat-4)")
        outer.append(
            AllocationSegment(
                name=name,
                pct=sum((h.value for h in group), start=ZERO) / total * 100,
                color=color,
            )
        )
        for index, holding in enumerate(group):
            inner.append(
                AllocationSegment(
                    name=holding.name,
                    pct=holding.value / total * 100,
                    color=f"color-mix(in oklch, {color}, white {index % 5 * 12}%)",
                )
            )
    return PortfolioAllocation(
        outer=outer,
        inner=inner,
        unvalued_count=sum(h.value is None for h in holdings),
    )


def operation_from_row(row, rates: ExchangeRateHistory | None = None) -> Operation:
    transaction, cash, stock_trade, stock, deposit, bond = row
    kind = {
        AssetType.cash: "Gotówka",
        AssetType.stock: "Akcje",
        AssetType.crypto: "Kryptowaluty",
        AssetType.metal: "Kruszce",
        AssetType.deposit: "Lokata",
        AssetType.bond: "Obligacje skarbowe",
    }[transaction.asset_type]
    if (
        transaction.asset_type == AssetType.stock
        and stock is not None
        and stock.quote_type == "CRYPTOCURRENCY"
    ):
        kind = "Kryptowaluty"
    name, qty, price, value = kind, None, None, None
    operation_type = transaction.type.value
    if cash is not None:
        name, value = f"Gotówka {transaction.currency.value}", cash.value
        operation_type = (
            "deposit" if transaction.type == TransactionType.buy else "withdrawal"
        )
    elif stock_trade is not None:
        name, qty, price = stock.name, stock_trade.volume, stock_trade.price_per_unit
        value = (
            stock_trade.total_value
            if stock_trade.total_value is not None
            else qty * price
        )
    elif deposit is not None:
        name, value = f"Lokata {deposit.annual_rate}%", deposit.value
    elif bond is not None:
        name, qty, price = bond.series_code, Decimal(bond.quantity), bond.price_per_unit
        value = qty * price if price is not None else None
    fx, fx_date = (
        rates.on(transaction.currency, transaction.date)
        if rates is not None
        else (None, None)
    )
    return Operation(
        id=transaction.id,
        type=operation_type,
        kind=kind,
        name=name,
        qty=qty,
        price=price,
        value=value,
        currency=transaction.currency,
        date=transaction.date,
        exchange_rate=fx,
        exchange_rate_date=fx_date,
        value_pln=value * fx if value is not None and fx is not None else None,
        quantity_unit="g" if transaction.asset_type == AssetType.metal else None,
        source_label=transaction.source_label,
    )


def validate_cash_change(daily, on: date, delta: Decimal, detail: str) -> None:
    """A manual edit must not create or worsen an existing imported deficit."""
    validate_cash_changes(daily, {on: delta}, detail)


def validate_cash_changes(daily, changes, detail: str) -> None:
    """Validate one or several changes against the same original cash ledger."""
    previous, changed = ZERO, ZERO
    for when in sorted(set(daily) | set(changes)):
        amount = daily.get(when, ZERO)
        previous += amount
        changed += amount + changes.get(when, ZERO)
        if changed < min(ZERO, previous):
            raise HTTPException(409, detail)


def create_cash_operation(
    db: Session, user: dict, data: CashOperationCreate
) -> Operation:
    user_id = UUID(user["sub"])
    with db.begin():
        # Profile creation and locking serialize balance changes.
        # This also covers concurrent first deposits.
        if not user.get("email"):
            raise HTTPException(400, "Konto nie ma adresu e-mail")
        db.execute(
            insert(Profile)
            .values(id=user_id, email=user["email"])
            .on_conflict_do_nothing(index_elements=[Profile.id])
        )
        db.execute(select(Profile.id).where(Profile.id == user_id).with_for_update())
        rows = db.execute(
            select(Transaction.date, Transaction.type, CashTransaction.value)
            .join(CashTransaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.asset_type == AssetType.cash,
                Transaction.currency == data.currency,
            )
        ).all()
        daily = defaultdict(lambda: ZERO)
        for operation_date, operation_type, value in rows:
            daily[operation_date] += (
                value if operation_type == TransactionType.buy else -value
            )
        validate_cash_change(
            daily,
            data.date,
            data.value if data.operation_type == "deposit" else -data.value,
            "Niewystarczające saldo gotówki w wybranej walucie i dacie",
        )
        transaction = Transaction(
            user_id=user_id,
            type=TransactionType.buy
            if data.operation_type == "deposit"
            else TransactionType.sell,
            asset_type=AssetType.cash,
            date=data.date,
            currency=data.currency,
        )
        db.add(transaction)
        db.flush()
        cash = CashTransaction(transaction_id=transaction.id, value=data.value)
        db.add(cash)
        db.flush()
        result = operation_from_row(
            (transaction, cash, None, None, None, None),
            ExchangeRateHistory(exchange_rates(db, [(data.currency, data.date)])),
        )
    return result


def create_deposit_operation(
    db: Session, user: dict, data: DepositOperationCreate
) -> Operation:
    user_id = UUID(user["sub"])
    with db.begin():
        if not user.get("email"):
            raise HTTPException(400, "Konto nie ma adresu e-mail")
        db.execute(
            insert(Profile)
            .values(id=user_id, email=user["email"])
            .on_conflict_do_nothing(index_elements=[Profile.id])
        )
        transaction = Transaction(
            user_id=user_id,
            type=TransactionType.buy,
            asset_type=AssetType.deposit,
            date=data.start_date,
            currency=data.currency,
        )
        db.add(transaction)
        db.flush()
        deposit = DepositTransaction(
            transaction_id=transaction.id,
            value=data.value,
            annual_rate=data.interest_rate,
            start_date=data.start_date,
            maturity_date=data.maturity_date,
        )
        db.add(deposit)
        db.flush()
        result = operation_from_row(
            (transaction, None, None, None, deposit, None),
            ExchangeRateHistory(exchange_rates(db, [(data.currency, data.start_date)])),
        )
    return result


def delete_operation(db: Session, user_id: UUID, transaction_id: UUID) -> None:
    with db.begin():
        # Use the same profile lock as cash creation to serialize balance changes.
        db.execute(select(Profile.id).where(Profile.id == user_id).with_for_update())
        transaction = db.scalar(
            select(Transaction)
            .where(
                Transaction.id == transaction_id,
                Transaction.user_id == user_id,
            )
            .with_for_update()
        )
        if transaction is None:
            from app.services.xtb_history import delete_import

            delete_import(db, user_id, transaction_id)
            return
        if transaction.external_id and transaction.external_id.startswith("xtb:"):
            raise HTTPException(
                409,
                "Operacja pochodzi z importu XTB. Nie można usunąć pojedynczej części "
                "rozliczenia bez naruszenia historii rachunku.",
            )
        if transaction.asset_type in (
            AssetType.stock,
            AssetType.metal,
            AssetType.crypto,
        ):
            trade = db.get(StockTransaction, transaction.id)
            if trade is not None:
                stock_id = trade.stock_id
                db.delete(trade)
                db.flush()
                validate_stock_position(
                    db,
                    user_id,
                    stock_id,
                    transaction.currency
                    if transaction.asset_type == AssetType.metal
                    else None,
                )
        if transaction.asset_type == AssetType.cash:
            rows = db.execute(
                select(Transaction.date, Transaction.type, CashTransaction.value)
                .join(CashTransaction)
                .where(
                    Transaction.user_id == user_id,
                    Transaction.asset_type == AssetType.cash,
                    Transaction.currency == transaction.currency,
                    Transaction.id != transaction_id,
                )
            ).all()
            daily = defaultdict(lambda: ZERO)
            for operation_date, operation_type, value in rows:
                daily[operation_date] += (
                    value if operation_type == TransactionType.buy else -value
                )
            cash = db.get(CashTransaction, transaction_id)
            if cash is not None:
                value = (
                    cash.value
                    if transaction.type == TransactionType.buy
                    else -cash.value
                )
                daily[transaction.date] += value
                validate_cash_change(
                    daily,
                    transaction.date,
                    -value,
                    "Nie można usunąć transakcji: saldo gotówki stałoby się ujemne",
                )
        # Detail rows have foreign keys without ON DELETE CASCADE.
        for model in (
            CashTransaction,
            DepositTransaction,
            StockTransaction,
            BondTransaction,
        ):
            db.execute(delete(model).where(model.transaction_id == transaction_id))
        db.delete(transaction)


def list_operations(db: Session, user_id: UUID) -> list[Operation]:
    from app.services.xtb_history import history_operations

    rows = transaction_rows(db, user_id)
    rates = ExchangeRateHistory(
        exchange_rates(db, [(row[0].currency, row[0].date) for row in rows])
    )
    return history_operations(db, user_id, rows, rates)


def list_holdings(db: Session, user_id: UUID) -> list[Holding]:
    return load_portfolio(db, user_id)[2]


def load_portfolio(db: Session, user_id: UUID):
    today = date.today()
    rows = transaction_rows(db, user_id)
    quantities = defaultdict(lambda: ZERO)
    for transaction, _, trade, _, _, _ in rows:
        if trade is not None:
            sign = ONE if transaction.type == TransactionType.buy else -ONE
            quantities[trade.stock_id, transaction.currency] += sign * trade.volume
    market, manual = stock_prices(
        db,
        user_id,
        [stock_id for (stock_id, _), qty in quantities.items() if qty != ZERO],
    )
    requested_rates = [(row[0].currency, row[0].date) for row in rows]
    requested_rates.extend((row[0].currency, today) for row in rows)
    requested_rates.extend((price.currency, today) for price in [*market, *manual])
    rates = ExchangeRateHistory(exchange_rates(db, requested_rates))
    bonds = BondValuator(
        *bond_valuation_sources(
            db, (row[5].series_code for row in rows if row[5] is not None), today
        )
    )
    holdings = holdings_from_rows(rows, rates, market, manual, today, bonds)
    return rows, rates, holdings, today


def holdings_from_rows(
    rows, rates, market, manual, on: date, bonds: BondValuator | None = None
) -> list[Holding]:
    """Value a portfolio snapshot using only observations available on its date."""
    rates = (
        rates if isinstance(rates, ExchangeRateHistory) else ExchangeRateHistory(rates)
    )
    positions: dict[str, Holding] = {}
    deposit_terms: dict[str, DepositTransaction] = {}
    bond_lots = defaultdict(list)
    for row in rows:
        transaction, cash, stock_trade, stock, deposit, bond = row
        if transaction.date > on:
            continue
        operation = operation_from_row(row)
        if cash is not None:
            asset_id, ticker, quantity = "cash", transaction.currency.value, cash.value
        elif stock_trade is not None:
            asset_id, ticker, quantity = str(stock.id), stock.ticker, stock_trade.volume
            if transaction.asset_type == AssetType.metal:
                ticker = METALS_BY_TICKER[stock.ticker].display_symbol
        elif deposit is not None:
            asset_id = (
                f"deposit:{deposit.annual_rate}:"
                f"{deposit.start_date}:{deposit.maturity_date}"
            )
            ticker, quantity = "LOK", deposit.value
        elif bond is not None:
            asset_id, ticker, quantity = (
                f"bond:{bond.series_code}",
                bond.series_code,
                Decimal(bond.quantity),
            )
        else:
            continue
        key = f"{asset_id}:{transaction.currency.value}"
        if deposit is not None:
            deposit_terms[key] = deposit
        if bond is not None:
            bond_lots[key].append((transaction, bond))
        if key not in positions:
            positions[key] = Holding(
                id=key,
                ticker=ticker,
                name=operation.name,
                asset_class=operation.kind,
                qty=ZERO,
                currency=transaction.currency,
                price=None,
                cost=ZERO,
                value=None,
                change=None,
                change_pct=None,
                color=ALLOCATION_CLASSES.get(operation.kind, "var(--cat-4)"),
                quantity_unit=operation.quantity_unit,
                valuation_note=(
                    "Orientacyjna wartość metalu według kontraktów terminowych Yahoo. "
                    "Nie uwzględnia premii monet i sztabek ani marży skupu."
                    if transaction.asset_type == AssetType.metal
                    else (
                        "Wycena ręczna — brak automatycznych notowań Yahoo."
                        if stock is not None and stock.manual_price_only
                        else None
                    )
                ),
            )
        position = positions[key]
        fx = exchange_rate_on(rates, transaction.currency, transaction.date)
        cost = (
            ZERO
            if operation.value == ZERO
            else (
                operation.value * fx
                if operation.value is not None and fx is not None
                else None
            )
        )
        if transaction.type == TransactionType.buy:
            position.qty += quantity
            position.cost = (
                position.cost + cost
                if position.cost is not None and cost is not None
                else None
            )
        else:
            if cash is not None:
                position.cost = (
                    position.cost - cost
                    if position.cost is not None and cost is not None
                    else None
                )
            elif position.qty > ZERO and position.cost is not None:
                position.cost *= (position.qty - quantity) / position.qty
            else:
                position.cost = None
            position.qty -= quantity
        if position.qty == ZERO:
            position.cost = ZERO

    prices = {}
    for price in [*market, *manual]:
        if price.price_date > on:
            continue
        existing = prices.get(price.stock_id)
        if existing is None or price.price_date >= existing.price_date:
            prices[price.stock_id] = price
    result = []
    for position in positions.values():
        if position.qty == ZERO:
            continue
        fx, fx_date = rates.on(position.currency, on)
        position.exchange_rate = fx
        position.exchange_rate_date = fx_date
        if position.asset_class == "Gotówka":
            position.value = position.qty * fx if fx is not None else None
        elif position.asset_class in ("Akcje", "Kruszce", "Kryptowaluty"):
            stock_id = UUID(position.id.split(":")[0])
            price = prices.get(stock_id)
            if price is not None:
                position.price = price.price
                position.price_date = price.price_date
                if position.asset_class == "Kruszce":
                    position.price_source = "Yahoo"
                position.price_currency = price.currency
                price_fx, price_fx_date = rates.on(price.currency, on)
                position.exchange_rate = price_fx
                position.exchange_rate_date = price_fx_date
                position.value = (
                    position.qty * price.price * price_fx
                    if price_fx is not None
                    else None
                )
        elif position.asset_class == "Lokata":
            deposit = deposit_terms[position.id]
            elapsed_days = max(
                0, (min(on, deposit.maturity_date) - deposit.start_date).days
            )
            # Simple gross interest using actual elapsed days and a 365-day year.
            growth = ONE + deposit.annual_rate / 100 * Decimal(elapsed_days) / 365
            position.value = position.qty * growth * fx if fx is not None else None
        elif position.asset_class == "Obligacje skarbowe":
            # Retail bonds use accrued gross interest rather than market quotes.
            try:
                if position.currency.value != "PLN":
                    raise BondValuationError("Obligacje skarbowe wymagają waluty PLN")
                values = []
                for transaction, bond in bond_lots[position.id]:
                    if transaction.type != TransactionType.buy:
                        raise BondValuationError(
                            "Brak obsługi rozliczenia sprzedaży obligacji"
                        )
                    values.append(
                        (bonds or BondValuator()).value(
                            bond.series_code, transaction.date, bond.quantity, on
                        )
                    )
                position.value = sum((item.value for item in values), ZERO)
                position.accrued_interest = sum(
                    (item.accrued_interest for item in values), ZERO
                )
                position.paid_interest = sum(
                    (item.paid_interest for item in values), ZERO
                )
                position.income_payments = [
                    HoldingIncomePayment(date=payment.date, amount=payment.amount)
                    for item in values
                    for payment in item.payments
                ]
                position.price = position.value / position.qty
                position.price_currency = position.currency
                position.price_date = on
                position.valuation_note = (
                    "Szacunkowa wartość brutto z naliczonymi odsetkami. "
                    "Bilans uwzględnia też "
                    "wypłacone kupony brutto; nie są dopisywane do salda gotówki."
                )
                if any(
                    (bonds.series[bond.series_code].family if bonds else None)
                    in ("COI", "EDO", "ROS", "ROD")
                    for _, bond in bond_lots[position.id]
                ):
                    position.valuation_note += (
                        " Historyczne odczyty GUS uwzględniają późniejsze korekty, "
                        "więc wynik może różnić się od tabel odsetkowych emitenta."
                    )
                if all(item.maturity_date <= on for item in values):
                    position.valuation_note += (
                        " Termin wykupu minął: pokazana jest należność z wykupu, "
                        "bez dalszego naliczania odsetek."
                    )
            except BondValuationError as error:
                position.valuation_note = str(error)
        if position.value is not None and position.cost is not None:
            position.change = (
                position.value + (position.paid_interest or ZERO) - position.cost
            )
            if position.cost > ZERO:
                position.change_pct = position.change / position.cost * 100
        result.append(position)
    return result
