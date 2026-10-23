from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.portfolio import (
    CashOperationCreate,
    DepositOperationCreate,
    Holding,
    Operation,
    PortfolioAllocation,
    PortfolioDashboard,
    PortfolioRange,
    PortfolioStatistics,
)
from app.services.portfolio import (
    create_cash_operation,
    create_deposit_operation,
    delete_operation,
    list_holdings,
    list_operations,
    portfolio_allocation,
)
from app.services.portfolio_statistics import portfolio_dashboard, portfolio_statistics

router = APIRouter()


@router.get("/portfolio/dashboard", response_model=PortfolioDashboard)
def dashboard(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return portfolio_dashboard(db, UUID(user["sub"]))


@router.get("/portfolio/statistics", response_model=PortfolioStatistics)
def statistics(
    range: PortfolioRange = "1R",
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return portfolio_statistics(db, UUID(user["sub"]), range)


@router.get("/portfolio/allocation", response_model=PortfolioAllocation)
def allocation(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return portfolio_allocation(db, UUID(user["sub"]))


@router.post("/transactions/cash", response_model=Operation, status_code=201)
def add_cash(
    data: CashOperationCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_cash_operation(db, user, data)


@router.post("/transactions/deposit", response_model=Operation, status_code=201)
def add_deposit(
    data: DepositOperationCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_deposit_operation(db, user, data)


@router.get("/transactions", response_model=list[Operation])
def transactions(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_operations(db, UUID(user["sub"]))


@router.delete("/transactions/{transaction_id}", status_code=204)
def remove_transaction(
    transaction_id: UUID,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_operation(db, UUID(user["sub"]), transaction_id)
    return Response(status_code=204)


@router.get("/portfolio/holdings", response_model=list[Holding])
def holdings(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_holdings(db, UUID(user["sub"]))
