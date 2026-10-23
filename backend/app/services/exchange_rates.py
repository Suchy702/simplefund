from bisect import bisect_right
from collections import defaultdict
from collections.abc import Iterable
from datetime import date
from decimal import Decimal

from app.models import ExchangeRate
from app.models.enums import Currency


class ExchangeRateHistory:
    """Index stored PLN-per-unit rates without looking ahead in time."""

    def __init__(self, rates: Iterable[ExchangeRate]):
        self._dates: dict[Currency, list[date]] = defaultdict(list)
        self._rates: dict[Currency, list[Decimal]] = defaultdict(list)
        for rate in sorted(rates, key=lambda row: row.rate_date):
            if not rate.rate.is_finite() or rate.rate <= 0:
                continue
            self._dates[rate.currency].append(rate.rate_date)
            self._rates[rate.currency].append(rate.rate)

    def on(self, currency: Currency, on: date) -> tuple[Decimal | None, date | None]:
        # PLN is the reporting currency and needs no stored observation.
        if currency == Currency.PLN:
            return Decimal(1), on
        dates = self._dates.get(currency, [])
        index = bisect_right(dates, on) - 1
        if index < 0:
            return None, None
        return self._rates[currency][index], dates[index]


def exchange_rate_on(
    rates: ExchangeRateHistory | Iterable[ExchangeRate], currency: Currency, on: date
) -> Decimal | None:
    history = (
        rates if isinstance(rates, ExchangeRateHistory) else ExchangeRateHistory(rates)
    )
    return history.on(currency, on)[0]
