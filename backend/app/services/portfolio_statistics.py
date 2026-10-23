from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, DecimalException
from math import isfinite
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.enums import TransactionType
from app.repositories.portfolio import exchange_rates, stock_prices, transaction_rows
from app.schemas.portfolio import (
    PerformanceStatistics,
    PortfolioKpi,
    PortfolioPoint,
    PortfolioRange,
    PortfolioStatistics,
)
from app.services.portfolio import (
    ONE,
    ZERO,
    exchange_rate_on,
    holdings_from_rows,
    operation_from_row,
)


def range_start(on: date, selected_range: PortfolioRange) -> date:
    if selected_range == "MAX":
        return date.min
    months = {"1M": 1, "3M": 3, "6M": 6, "1R": 12}[selected_range]
    year, month = divmod(on.year * 12 + on.month - 1 - months, 12)
    month += 1
    return date(year, month, min(on.day, monthrange(year, month)[1]))


def performance_statistics(
    series: list[PortfolioPoint], returns: list[Decimal | None]
) -> PerformanceStatistics | None:
    """Summarize ordered daily values; missing observations invalidate the range."""
    if not series or any(point.value is None for point in series):
        return None
    # The guard above ensures every value used below is known.
    values = [point.value for point in series if point.value is not None]
    peak_index = values.index(max(values))
    trough_index = values.index(min(values))
    peak_so_far = values[0]
    max_dd, max_dd_pln = ZERO, ZERO
    for value in values:
        peak_so_far = max(peak_so_far, value)
        if peak_so_far > ZERO:
            decline = (value - peak_so_far) / peak_so_far
            if decline < max_dd:
                max_dd, max_dd_pln = decline, value - peak_so_far

    std_pct = None
    if len(returns) >= 2 and all(value is not None for value in returns):
        known_returns = [value for value in returns if value is not None]
        mean = sum(known_returns, ZERO) / len(known_returns)
        variance = sum(((value - mean) ** 2 for value in known_returns), ZERO) / (
            len(known_returns) - 1
        )
        std_pct = (variance * 365).sqrt() * 100

    change = values[-1] - values[0]
    return PerformanceStatistics(
        peak=values[peak_index],
        trough=values[trough_index],
        peak_date=series[peak_index].date,
        trough_date=series[trough_index].date,
        std_pct=std_pct,
        max_dd=max_dd,
        max_dd_pln=max_dd_pln,
        change=change,
        change_pct=change / values[0] * 100 if values[0] > ZERO else None,
    )


def annualized_return(
    series: list[PortfolioPoint], returns: list[Decimal | None]
) -> Decimal | None:
    if len(series) < 2 or any(point.value is None for point in series):
        return None
    if series[0].value is None or series[0].value <= ZERO:
        return None
    growth = ONE
    for daily_return in returns:
        if daily_return is None or daily_return < -ONE:
            return None
        growth *= ONE + daily_return
    days = (series[-1].date - series[0].date).days
    if not days:
        return None
    try:
        result = (growth ** (Decimal(365) / days) - ONE) * 100
        return result if isfinite(float(result)) else None
    except (DecimalException, OverflowError):
        return None


def portfolio_statistics(
    db: Session, user_id: UUID, selected_range: PortfolioRange = "1R"
) -> PortfolioStatistics:
    """Read data once and reuse the holdings valuation for every historical date.

    The current ledger records each asset independently: buys and deposits add
    capital, sells and withdrawals remove it. It does not record transfers from
    cash to other assets. Returns therefore treat all these movements as flows.
    Prices and FX rates are carried forward, never backward from a future date.
    """
    today = date.today()
    rows = transaction_rows(db, user_id)
    rates = exchange_rates(db)
    market, manual = stock_prices(db, user_id)
    flows: dict[date, Decimal | None] = defaultdict(lambda: ZERO)
    for row in rows:
        transaction = row[0]
        operation = operation_from_row(row)
        fx = exchange_rate_on(rates, transaction.currency, transaction.date)
        previous = flows[transaction.date]
        if previous is None or operation.value is None or fx is None:
            flows[transaction.date] = None
        else:
            sign = ONE if transaction.type == TransactionType.buy else -ONE
            flows[transaction.date] = previous + sign * operation.value * fx
    total_contrib = (
        sum((value for value in flows.values() if value is not None), ZERO)
        if all(value is not None for value in flows.values())
        else None
    )

    history: list[PortfolioPoint] = []
    returns: list[Decimal | None] = []
    holdings = []
    on = rows[0][0].date if rows else today
    previous_value = None
    while on <= today:
        holdings = holdings_from_rows(rows, rates, market, manual, on)
        value = (
            sum((h.value for h in holdings if h.value is not None), ZERO)
            if all(h.value is not None for h in holdings)
            else None
        )
        flow = flows.get(on, ZERO)
        if history:
            daily_return = None
            if previous_value is not None and value is not None and flow is not None:
                if previous_value > ZERO:
                    daily_return = (value - flow) / previous_value - ONE
                elif previous_value == ZERO and value == flow:
                    # No capital was exposed during this interval.
                    daily_return = ZERO
            returns.append(daily_return)
        if rows:
            history.append(PortfolioPoint(date=on, value=value))
        previous_value = value
        on += timedelta(days=1)

    total_value = previous_value
    balance = (
        total_value - total_contrib
        if total_value is not None and total_contrib is not None
        else None
    )
    kpi = PortfolioKpi(
        as_of_date=today,
        total_contrib=total_contrib,
        total_value=total_value,
        balance=balance,
        roi=balance / total_contrib * 100
        if balance is not None and total_contrib is not None and total_contrib > ZERO
        else None,
        cagr=annualized_return(history, returns),
        unvalued_count=sum(h.value is None for h in holdings),
    )
    start = range_start(today, selected_range)
    offset = next((i for i, point in enumerate(history) if point.date >= start), 0)
    series = history[offset:]
    return PortfolioStatistics(
        range=selected_range,
        kpi=kpi,
        series=series,
        performance=performance_statistics(series, returns[offset:]),
    )
