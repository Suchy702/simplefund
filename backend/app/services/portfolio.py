from collections import defaultdict
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import CashTransaction, Profile, Transaction
from app.models.enums import AssetType, Currency, TransactionType
from app.repositories.portfolio import exchange_rates, stock_prices, transaction_rows
from app.schemas.portfolio import CashOperationCreate, Holding, Operation

ZERO = Decimal(0)
ONE = Decimal(1)


def operation_from_row(row) -> Operation:
    transaction, cash, stock_trade, stock, deposit, bond = row
    kind = {
        AssetType.cash: "Gotówka",
        AssetType.stock: "Akcje",
        AssetType.deposit: "Lokata",
        AssetType.bond: "Obligacje",
    }[transaction.asset_type]
    name, qty, price, value = kind, None, None, None
    operation_type = transaction.type.value
    if cash is not None:
        name, value = f"Gotówka {transaction.currency.value}", cash.value
        operation_type = (
            "deposit" if transaction.type == TransactionType.buy else "withdrawal"
        )
    elif stock_trade is not None:
        name, qty, price = stock.name, stock_trade.volume, stock_trade.price_per_unit
        value = qty * price
    elif deposit is not None:
        name, value = f"Lokata {deposit.annual_rate}%", deposit.value
    elif bond is not None:
        name, qty, price = bond.series_code, Decimal(bond.quantity), bond.price_per_unit
        value = qty * price if price is not None else None
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
    )


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
        daily[data.date] += (
            data.value if data.operation_type == "deposit" else -data.value
        )
        balance = ZERO
        for operation_date in sorted(daily):
            balance += daily[operation_date]
            if balance < ZERO:
                raise HTTPException(
                    409, "Niewystarczające saldo gotówki w wybranej walucie i dacie"
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
        result = operation_from_row((transaction, cash, None, None, None, None))
    return result


def list_operations(db: Session, user_id: UUID) -> list[Operation]:
    return [operation_from_row(row) for row in reversed(transaction_rows(db, user_id))]


def list_holdings(db: Session, user_id: UUID) -> list[Holding]:
    rates = exchange_rates(db)

    def rate(currency: Currency, on: date) -> Decimal | None:
        if currency == Currency.PLN:
            return ONE
        return next(
            (
                r.rate
                for r in reversed(rates)
                if r.currency == currency and r.rate_date <= on
            ),
            None,
        )

    positions: dict[str, Holding] = {}
    for row in transaction_rows(db, user_id):
        transaction, cash, stock_trade, stock, deposit, bond = row
        operation = operation_from_row(row)
        if cash is not None:
            asset_id, ticker, quantity = "cash", transaction.currency.value, cash.value
        elif stock_trade is not None:
            asset_id, ticker, quantity = str(stock.id), stock.ticker, stock_trade.volume
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
                color="var(--cat-3)",
            )
        position = positions[key]
        fx = rate(transaction.currency, transaction.date)
        cost = (
            operation.value * fx
            if operation.value is not None and fx is not None
            else None
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

    market, manual = stock_prices(db, user_id)
    prices = {}
    for price in [*market, *manual]:
        existing = prices.get(price.stock_id)
        if existing is None or price.price_date >= existing.price_date:
            prices[price.stock_id] = price
    result = []
    for position in positions.values():
        if position.qty == ZERO:
            continue
        fx = rate(position.currency, date.today())
        if position.asset_class == "Gotówka":
            position.value = position.qty * fx if fx is not None else None
        elif position.asset_class == "Akcje":
            stock_id = UUID(position.id.split(":")[0])
            price = prices.get(stock_id)
            if price is not None and price.currency == position.currency:
                position.price = price.price
                position.value = (
                    position.qty * price.price * fx if fx is not None else None
                )
        # Term deposit and bond valuations need an interest/market valuation model.
        if position.value is not None and position.cost is not None:
            position.change = position.value - position.cost
            if position.cost > ZERO:
                position.change_pct = position.change / position.cost * 100
        result.append(position)
    return result
