import json
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from functools import lru_cache
from time import monotonic
from urllib.request import Request, urlopen

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import ExchangeRate
from app.models.enums import Currency

logger = logging.getLogger(__name__)


@lru_cache(maxsize=512)
def _fetch_rate(currency: Currency, on: date, cache_window: int) -> dict:
    """Retrieve PLN per currency unit; the window expires cached observations."""
    request = Request(
        f"https://api.frankfurter.dev/v2/rate/{currency.value}/PLN?date={on.isoformat()}",
        headers={"User-Agent": "SimpleFund/1.0", "Accept": "application/json"},
    )
    with urlopen(request, timeout=5) as response:
        payload = json.load(response, parse_float=Decimal)
    observed = date.fromisoformat(payload["date"])
    rate = Decimal(str(payload["rate"]))
    if (
        payload.get("base") != currency.value
        or payload.get("quote") != "PLN"
        or observed > on
        or not rate.is_finite()
        or not 0 < rate < Decimal("1000000000000")
    ):
        raise ValueError("Invalid Frankfurter observation")
    rounded = rate.quantize(Decimal("0.000001"))
    if rounded <= 0:
        raise ValueError("Frankfurter rate is below stored precision")
    return {"currency": currency, "rate_date": observed, "rate": rounded}


def fetch_rates(requests: list[tuple[Currency, date]]) -> list[dict]:
    observations = {}
    for currency, on in sorted(
        set(requests), key=lambda item: (item[0].value, item[1])
    ):
        if currency == Currency.PLN:
            continue
        try:
            row = _fetch_rate(currency, on, int(monotonic() // 900))
            observations[currency, row["rate_date"]] = row
        except Exception:
            # A missing FX rate leaves the valuation unavailable, never guessed.
            logger.warning(
                "Frankfurter rate unavailable for %s on %s",
                currency.value,
                on,
                exc_info=True,
            )
    return list(observations.values())


def store_rates(db: Session, observations: list[dict]) -> None:
    if not observations:
        return
    statement = insert(ExchangeRate).values(
        [dict(row, updated_at=datetime.now(timezone.utc)) for row in observations]
    )
    db.execute(
        statement.on_conflict_do_update(
            index_elements=[ExchangeRate.currency, ExchangeRate.rate_date],
            set_={
                "rate": statement.excluded.rate,
                "updated_at": statement.excluded.updated_at,
            },
        )
    )
