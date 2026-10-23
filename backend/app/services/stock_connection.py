import logging
from datetime import datetime, timezone
from time import monotonic

import yfinance as yf

from app.schemas.admin import StockConnectionCheck

logger = logging.getLogger(__name__)
TEST_SYMBOL = "AAPL"


def check_stock_connection() -> StockConnectionCheck:
    started = monotonic()
    try:
        ticker = yf.Ticker(TEST_SYMBOL)
        history = ticker.history(
            period="5d",
            interval="1d",
            auto_adjust=False,
            timeout=5,
            raise_errors=True,
        )
        if history.empty:
            raise ValueError("No stock prices returned")
        currency = ticker.get_history_metadata().get("currency")
        if not isinstance(currency, str) or not currency.strip():
            raise ValueError("Missing stock currency")
        return StockConnectionCheck(
            status="ok",
            detail="Pobrano ostatnie dzienne notowanie Apple (AAPL) z Yahoo Finance.",
            checked_at=datetime.now(timezone.utc),
            response_time_ms=round((monotonic() - started) * 1000),
            symbol=TEST_SYMBOL,
            price=float(history["Close"].iloc[-1]),
            currency=currency,
            price_date=history.index[-1].date(),
        )
    except Exception:
        # yfinance can raise transport, rate-limit, parsing, or data errors.
        logger.exception("Yahoo Finance connection check failed")
        return StockConnectionCheck(
            status="error",
            detail=(
                "Nie udało się pobrać poprawnego notowania z Yahoo Finance. "
                "Spróbuj ponownie."
            ),
            checked_at=datetime.now(timezone.utc),
            response_time_ms=round((monotonic() - started) * 1000),
            symbol=TEST_SYMBOL,
        )
