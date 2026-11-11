from dataclasses import replace
from datetime import date
from decimal import Decimal

from fastapi import HTTPException

from app.models.enums import Currency
from app.models.metals import GRAMS_PER_TROY_OUNCE, METALS, METALS_BY_TICKER, Metal
from app.schemas.metals import MetalPriceSuggestion
from app.services.frankfurter import fetch_rates
from app.services.yahoo import MarketSnapshot, market_snapshot, suggest_stock_price


def suggest_metal_price(
    metal: Metal, on: date, currency: Currency
) -> MetalPriceSuggestion:
    quote = suggest_stock_price(
        METALS[metal].yahoo_symbol, on, Currency.USD, expected_quote_type="FUTURE"
    )
    price = quote.price / GRAMS_PER_TROY_OUNCE
    rates = {}
    if currency != Currency.USD:
        rates = {
            row["currency"]: row
            for row in fetch_rates(
                [
                    (Currency.USD, on),
                    (currency, on),
                ]
            )
        }
        required = {Currency.USD, currency} - {Currency.PLN}
        if not required.issubset(rates):
            raise HTTPException(
                503,
                "Brak kursu Frankfurter dla wybranej daty. "
                "Wpisz cenę transakcji ręcznie.",
            )
        price *= rates[Currency.USD]["rate"]
        if currency != Currency.PLN:
            price /= rates[currency]["rate"]
    price = price.quantize(Decimal("0.0001"))
    if price <= 0:
        raise HTTPException(422, "Cena za gram jest poniżej obsługiwanej precyzji.")
    return MetalPriceSuggestion(
        metal=metal,
        currency=currency,
        price_per_gram=price,
        price_date=quote.price_date,
        requested_date=on,
        usd_rate_date=rates.get(Currency.USD, {}).get("rate_date"),
        currency_rate_date=rates.get(currency, {}).get("rate_date"),
    )


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
