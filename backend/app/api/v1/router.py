from datetime import date
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.enums import Currency
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
from app.schemas.stocks import (
    StockInstrument,
    StockOperationCreate,
    StockPriceSuggestion,
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
from app.services.stock_prices import invalidate_user_prices, refresh_user_prices
from app.services.stocks import create_stock_operation, list_held_stocks
from app.services.yahoo import search_stocks, suggest_stock_price

router = APIRouter()


@router.get("/portfolio/dashboard", response_model=PortfolioDashboard)
def dashboard(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = UUID(user["sub"])
    result = portfolio_dashboard(db, user_id)
    background_tasks.add_task(refresh_user_prices, user_id)
    return result


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


@router.get("/stocks/held", response_model=list[StockInstrument])
def held_instruments(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_held_stocks(db, UUID(user["sub"]))


@router.get("/stocks/search", response_model=list[StockInstrument])
def search_instruments(
    q: str = Query(min_length=1, max_length=100, pattern=r"\S"),
    user: dict = Depends(get_current_user),
):
    return search_stocks(q)


@router.get("/stocks/price", response_model=StockPriceSuggestion)
def stock_price_suggestion(
    ticker: str = Query(min_length=1, max_length=64, pattern=r"^\S+$"),
    on: date = Query(alias="date"),
    currency: Currency = Query(),
    user: dict = Depends(get_current_user),
):
    return suggest_stock_price(ticker, on, currency)


@router.post("/transactions/stocks", response_model=Operation, status_code=201)
def add_stock(
    data: StockOperationCreate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = create_stock_operation(db, user, data)
    user_id = UUID(user["sub"])
    invalidate_user_prices(user_id)
    background_tasks.add_task(refresh_user_prices, user_id)
    return result


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
