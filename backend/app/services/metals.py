import logging

from sqlalchemy.orm import Session

from app.models.enums import AssetType
from app.models.metals import METALS
from app.schemas.metals import MetalInstrument, MetalOperationCreate
from app.schemas.portfolio import Operation
from app.schemas.stocks import StockInstrument, StockOperationCreate
from app.services.metal_prices import metal_snapshot
from app.services.stocks import create_instrument_operation

logger = logging.getLogger(__name__)


def list_metals() -> list[MetalInstrument]:
    return [
        MetalInstrument(metal=metal, name=item.name, yahoo_symbol=item.yahoo_symbol)
        for metal, item in METALS.items()
    ]


def create_metal_operation(
    db: Session, user: dict, data: MetalOperationCreate
) -> Operation:
    definition = METALS[data.metal]
    snapshot = None
    try:
        snapshot = metal_snapshot(definition.ticker)
    except Exception:
        # A known physical metal can be recorded even during a Yahoo outage.
        logger.warning(
            "Metal price unavailable for %s", definition.ticker, exc_info=True
        )
    instrument = StockInstrument(
        ticker=definition.ticker,
        name=definition.name,
        currency="USD",
        quote_type="METAL",
        can_transact=True,
    )
    trade = StockOperationCreate.model_validate(
        {
            "ticker": definition.ticker,
            "operationType": data.operation_type,
            "volume": data.grams,
            "pricePerUnit": data.price_per_gram,
            "date": data.date,
        }
    )
    return create_instrument_operation(
        db, user, trade, instrument, data.currency, snapshot, AssetType.metal
    )
