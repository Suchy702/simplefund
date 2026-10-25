"""Gross retail-bond accrual, with no taxes or early-redemption charges.

Annual indexed rates use headline CPI for the observation month two months
before the new period. ROR/DOR fix NBP ten Polish business days before that
period's calendar month. Each lot keeps its purchase-day anniversary.
The stored GUS series contains revised observations, so inflation-linked
valuations are estimates rather than a reconstruction of original rate notices.

Cash coupons are distributions, not reinvestments. Maturity proceeds remain
a terminal receivable in the holding until the recorded position is removed.
No network access or database writes are performed during valuation.
"""

from bisect import bisect_right
from calendar import monthrange
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache

from app.models.bond_series import BondSeries
from app.models.polish_macro import NbpReferenceRate, PolishInflation

ZERO = Decimal(0)
NOMINAL = Decimal(100)
CENT = Decimal("0.01")
# Contractual duration, period length in months, annual capitalization.
RULES = {
    "OTS": (3, 3, False),
    "TOS": (36, 12, True),
    "COI": (48, 12, False),
    "EDO": (120, 12, True),
    "ROS": (72, 12, True),
    "ROD": (144, 12, True),
    "ROR": (12, 1, False),
    "DOR": (24, 1, False),
}


class BondValuationError(ValueError):
    """The position cannot be valued from available source observations."""


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def add_months(on: date, months: int) -> date:
    year, month_index = divmod(on.year * 12 + on.month - 1 + months, 12)
    month = month_index + 1
    return date(year, month, min(on.day, monthrange(year, month)[1]))


@lru_cache(maxsize=128)
def polish_holidays(year: int) -> frozenset[date]:
    # Gregorian Easter (Meeus/Jones/Butcher); Easter Monday and Corpus Christi
    # are Polish public holidays. Sundays and Saturdays are handled separately.
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    weekday_offset = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * weekday_offset) // 451
    month, day_index = divmod(h + weekday_offset - 7 * m + 114, 31)
    easter = date(year, month, day_index + 1)
    fixed = [(1, 1), (5, 1), (5, 3), (8, 15), (11, 1), (11, 11), (12, 25), (12, 26)]
    if year >= 2011:
        fixed.append((1, 6))
    if year >= 2025:
        fixed.append((12, 24))
    holidays = {date(year, month, day) for month, day in fixed}
    holidays.update((easter + timedelta(days=1), easter + timedelta(days=60)))
    if year == 2018:
        holidays.add(date(2018, 11, 12))
    return frozenset(holidays)


def is_business_day(on: date) -> bool:
    return on.weekday() < 5 and on not in polish_holidays(on.year)


def payment_date(on: date) -> date:
    while not is_business_day(on):
        on += timedelta(days=1)
    return on


def reference_fixing_date(period_start: date) -> date:
    on = period_start.replace(day=1)
    remaining = 10
    while remaining:
        on -= timedelta(days=1)
        if is_business_day(on):
            remaining -= 1
    return on


@dataclass(frozen=True)
class CouponPayment:
    date: date
    amount: Decimal


@dataclass(frozen=True)
class BondValuation:
    value: Decimal
    accrued_interest: Decimal
    paid_interest: Decimal
    payments: tuple[CouponPayment, ...]
    maturity_date: date


def required_rate(value: Decimal | None, description: str) -> Decimal:
    if value is None or not value.is_finite() or value < ZERO:
        raise BondValuationError(f"Brak poprawnych danych: {description}")
    return value


class BondValuator:
    def __init__(
        self,
        series: Iterable[BondSeries] = (),
        inflation: Iterable[PolishInflation] = (),
        reference_rates: Iterable[NbpReferenceRate] = (),
    ) -> None:
        self.series = {item.series_code: item for item in series}
        self.inflation = {item.month: item.rate_pct for item in inflation}
        references = sorted(reference_rates, key=lambda item: item.effective_from)
        self.reference_dates = [item.effective_from for item in references]
        self.reference_values = [item.rate_pct for item in references]

    def period_rate(self, series: BondSeries, start: date, period: int) -> Decimal:
        if series.family in ("TOS", "OTS"):
            return required_rate(series.fixed_rate_pct, "oprocentowanie stałe")
        if period == 0:
            return required_rate(
                series.first_period_rate_pct, "oprocentowanie początkowe"
            )
        if series.family in ("ROR", "DOR"):
            fixing = reference_fixing_date(start)
            index = bisect_right(self.reference_dates, fixing) - 1
            if index < 0:
                raise BondValuationError(f"Brak stopy referencyjnej NBP na {fixing}")
            base = self.reference_values[index]
            if not base.is_finite():
                raise BondValuationError(f"Niepoprawna stopa NBP na {fixing}")
            return max(ZERO, base) + required_rate(series.nbp_margin_pp, "marża NBP")
        observation = add_months(start.replace(day=1), -2)
        base = self.inflation.get(observation)
        if base is None or not base.is_finite():
            raise BondValuationError(f"Brak inflacji GUS za {observation:%Y-%m}")
        return max(ZERO, base) + required_rate(
            series.inflation_margin_pp, "marża inflacyjna"
        )

    def value(
        self, code: str, purchased: date, quantity: int, on: date
    ) -> BondValuation:
        series = self.series.get(code)
        if series is None or series.family not in RULES:
            raise BondValuationError(f"Brak warunków emisji {code}")
        term, period_months, capitalizes = RULES[series.family]
        if (
            series.term_months != term
            or series.sale_start is None
            or series.sale_end is None
            or not series.sale_start <= purchased <= series.sale_end
            or quantity <= 0
            or purchased > on
        ):
            raise BondValuationError(f"Niepoprawne warunki zakupu {code}")
        maturity = add_months(purchased, term)
        valued_on = min(on, maturity)
        # Preserve exact compounded factors; round each bond's reported value
        # and cash coupon, never the entire lot before per-bond rounding.
        capital = NOMINAL
        unit_value = NOMINAL
        pending = ZERO
        payments = []
        for period in range(term // period_months):
            start = add_months(purchased, period * period_months)
            end = add_months(purchased, (period + 1) * period_months)
            if valued_on <= start:
                break
            rate = self.period_rate(series, start, period) / 100
            elapsed = Decimal((min(valued_on, end) - start).days)
            days = Decimal((end - start).days)
            if capitalizes:
                if valued_on >= end:
                    capital *= 1 + rate
                    unit_value = capital
                else:
                    # TOS explicitly uses the rounded previous anniversary
                    # balance for accrual inside the next annual period.
                    basis = money(capital) if series.family == "TOS" else capital
                    unit_value = basis * (1 + rate * elapsed / days)
            else:
                if series.family == "OTS":
                    # OTS uses actual days and a 365-day year, including its
                    # maturity coupon; three calendar months are not 1/4 year.
                    coupon = money(NOMINAL * rate * elapsed / 365)
                else:
                    frequency = Decimal(12) / period_months
                    coupon = money(NOMINAL * rate / frequency * elapsed / days)
                if valued_on < end or end == maturity:
                    unit_value = NOMINAL + coupon
                else:
                    due = payment_date(end)
                    if due <= on:
                        payments.append(CouponPayment(due, coupon * quantity))
                    else:
                        pending += coupon
                    unit_value = NOMINAL
            if valued_on <= end:
                break
        value = (money(unit_value) + pending) * quantity
        return BondValuation(
            value=value,
            accrued_interest=value - NOMINAL * quantity,
            paid_interest=sum((item.amount for item in payments), ZERO),
            payments=tuple(payments),
            maturity_date=maturity,
        )
