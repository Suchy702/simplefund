from dataclasses import replace
from decimal import Decimal

from app.models.metals import GRAMS_PER_TROY_OUNCE, METALS_BY_TICKER
from app.services.yahoo import MarketSnapshot, market_snapshot


def metal_snapshot(ticker: str) -> MarketSnapshot:
    definition = METALS_BY_TICKER[ticker]
    snapshot = market_snapshot(definition.yahoo_symbol)
    if (
        snapshot.instrument.currency != "USD"
        or snapshot.instrument.quote_type != "FUTURE"
    ):
        raise ValueError("Unexpected Yahoo metal quote currency or instrument type")
    prices = tuple(
        (on, (price / GRAMS_PER_TROY_OUNCE).quantize(Decimal("0.0001")))
        for on, price in snapshot.prices
    )
    if any(price <= 0 for _, price in prices):
        raise ValueError("Metal price is below stored precision")
    instrument = snapshot.instrument.model_copy(
        update={
            "ticker": definition.ticker,
            "name": definition.name,
            "quote_type": "METAL",
        }
    )
    return replace(snapshot, instrument=instrument, prices=prices)
