from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.portfolio import CashOperationCreate, Holding, Operation
from app.services.portfolio import create_cash_operation, list_holdings, list_operations

router = APIRouter()


@router.post("/transactions/cash", response_model=Operation, status_code=201)
def add_cash(
    data: CashOperationCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_cash_operation(db, user, data)


@router.get("/transactions", response_model=list[Operation])
def transactions(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_operations(db, UUID(user["sub"]))


@router.get("/portfolio/holdings", response_model=list[Holding])
def holdings(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_holdings(db, UUID(user["sub"]))
