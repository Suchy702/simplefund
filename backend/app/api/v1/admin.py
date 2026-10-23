from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response

from app.dependencies import get_current_admin
from app.schemas.admin import AdminConnections, ConnectionCheck, StockConnectionCheck
from app.services.admin import check_currency_connection
from app.services.stock_connection import check_stock_connection

router = APIRouter(prefix="/admin", dependencies=[Depends(get_current_admin)])


@router.get("/connections", response_model=AdminConnections)
def connections(response: Response) -> AdminConnections:
    response.headers["Cache-Control"] = "no-store"
    return AdminConnections(
        backend=ConnectionCheck(
            status="ok",
            detail="Backend odpowiada. Potwierdzono uprawnienia administratora.",
            checked_at=datetime.now(timezone.utc),
        ),
        currency=check_currency_connection(),
    )


@router.get("/connections/stocks", response_model=StockConnectionCheck)
def stock_connection(response: Response) -> StockConnectionCheck:
    response.headers["Cache-Control"] = "no-store"
    return check_stock_connection()
