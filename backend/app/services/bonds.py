from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import BondSeries, BondTransaction, Profile, Transaction
from app.models.enums import AssetType, Currency, TransactionType
from app.repositories.portfolio import exchange_rates
from app.schemas.bonds import (
    BOND_FAMILIES,
    BondFamily,
    BondOperationCreate,
    BondSeriesOption,
)
from app.schemas.portfolio import Operation
from app.services.exchange_rates import ExchangeRateHistory
from app.services.portfolio import operation_from_row

BOND_PRICE = Decimal("100.00")


def list_bond_series(
    db: Session, on: date, family: BondFamily | None = None
) -> list[BondSeriesOption]:
    if on > date.today():
        raise HTTPException(422, "Data zakupu nie może być w przyszłości")
    statement = select(BondSeries).where(
        BondSeries.family.in_(BOND_FAMILIES),
        BondSeries.sale_start <= on,
        BondSeries.sale_end >= on,
    )
    if family is not None:
        statement = statement.where(BondSeries.family == family)
    return [
        BondSeriesOption.model_validate(
            {
                "series_code": series.series_code,
                "family": series.family,
                "sale_start": series.sale_start,
                "sale_end": series.sale_end,
                "term_months": series.term_months,
                "price_per_unit": BOND_PRICE,
                "initial_rate_pct": (
                    series.fixed_rate_pct
                    if series.fixed_rate_pct is not None
                    else series.first_period_rate_pct
                ),
            }
        )
        for series in db.scalars(
            statement.order_by(BondSeries.sale_start.desc(), BondSeries.series_code)
        )
    ]


def create_bond_operation(
    db: Session, user: dict, data: BondOperationCreate
) -> Operation:
    user_id = UUID(user["sub"])
    with db.begin():
        series = db.get(BondSeries, data.series_code)
        if series is None or series.family not in BOND_FAMILIES:
            raise HTTPException(404, "Nie znaleziono emisji obligacji")
        if (
            series.sale_start is None
            or series.sale_end is None
            or not series.sale_start <= data.date <= series.sale_end
        ):
            raise HTTPException(422, "Emisja nie była dostępna w dniu zakupu")
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
            asset_type=AssetType.bond,
            date=data.date,
            currency=Currency.PLN,
        )
        db.add(transaction)
        db.flush()
        bond = BondTransaction(
            transaction_id=transaction.id,
            series_code=series.series_code,
            quantity=data.quantity,
            price_per_unit=BOND_PRICE,
        )
        db.add(bond)
        db.flush()
        result = operation_from_row(
            (transaction, None, None, None, None, bond),
            ExchangeRateHistory(exchange_rates(db, [(Currency.PLN, data.date)])),
        )
    return result
