from calendar import monthrange
from collections import defaultdict
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from math import exp, expm1, fsum, isfinite
from time import monotonic
from types import SimpleNamespace
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.enums import TransactionType
from app.repositories.portfolio import (
    bond_valuation_sources,
    exchange_rates,
    stock_prices,
    transaction_rows,
)
from app.schemas.portfolio import (
    Holding,
    PerformanceStatistics,
    PortfolioDashboard,
    PortfolioKpi,
    PortfolioPoint,
    PortfolioRange,
    PortfolioStatistics,
)
from app.services.bond_valuation import BondValuator
from app.services.exchange_rates import ExchangeRateHistory, exchange_rate_on
from app.services.portfolio import (
    ONE,
    ZERO,
    PortfolioLedger,
    allocation_from_holdings,
    load_portfolio,
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


def xirr(
    contributions: dict[date, Decimal | None],
    final_value: Decimal | None,
    on: date,
) -> Decimal | None:
    """Solve dated investor cash flows plus terminal value, returning annual %."""
    if final_value is None or not final_value.is_finite() or final_value < ZERO:
        return None
    cash_flows: dict[date, Decimal] = {}
    for when, amount in contributions.items():
        if amount is None or not amount.is_finite() or when > on:
            return None
        # This ledger funds assets independently: buys/deposits are investor
        # outflows, while sells/withdrawals return capital to the investor.
        cash_flows[when] = -amount
    cash_flows[on] = cash_flows.get(on, ZERO) + final_value
    dated = sorted((when, amount) for when, amount in cash_flows.items() if amount)
    if len(dated) < 2:
        return None
    amounts = [amount for _, amount in dated]
    if not any(amount < ZERO for amount in amounts) or not any(
        amount > ZERO for amount in amounts
    ):
        return None
    scale = max(abs(amount) for amount in amounts)
    payments = [
        ((when - dated[0][0]).days / 365, float(amount / scale))
        for when, amount in dated
    ]

    def present_value(log_growth: float) -> float:
        # Solve in log(1 + rate), keeping rates above -100%. Scaling all
        # discounted payments by the same factor prevents exponential overflow.
        exponents = [-log_growth * years for years, _ in payments]
        shift = max(exponents)
        return fsum(
            amount * exp(exponent - shift)
            for (_, amount), exponent in zip(payments, exponents)
        )

    at_zero = present_value(0)
    if at_zero == 0:
        return ZERO
    lower, upper = -0.5, 0.5
    for _ in range(7):
        low_value, high_value = present_value(lower), present_value(upper)
        if low_value * high_value <= 0:
            break
        lower *= 2
        upper *= 2
    else:
        return None

    for _ in range(100):
        middle = (lower + upper) / 2
        value = present_value(middle)
        if value == 0 or upper - lower < 1e-12:
            result = expm1(middle) * 100
            return Decimal(str(result)) if isfinite(result) and result > -100 else None
        if (value > 0) == (low_value > 0):
            lower, low_value = middle, value
        else:
            upper = middle
    return None


def portfolio_statistics(
    db: Session, user_id: UUID, selected_range: PortfolioRange = "1R"
) -> PortfolioStatistics:
    """Read saved history; GET requests never trigger historical calculations."""
    from app.services.portfolio_history import get_history

    rows, rates, holdings, today = load_portfolio(db, user_id)
    result = statistics_from_holdings(rows, rates, holdings, today, selected_range)
    saved = get_history(db, user_id, selected_range)
    result.series = saved.series
    result.performance = saved.performance
    return result


def calculate_portfolio_statistics(
    db: Session,
    user_id: UUID,
    selected_range: PortfolioRange = "1R",
    *,
    on_progress: Callable[[], None] | None = None,
    split_events: dict[UUID, dict[str, str]] | None = None,
    closed_prices_only: bool = False,
) -> PortfolioStatistics:
    """Return current KPIs and daily valuations from stored observations."""
    rows = transaction_rows(db, user_id)
    today = date.today()
    if not rows:
        return statistics_from_holdings(
            rows, ExchangeRateHistory(()), [], today, selected_range
        )
    if split_events:
        normalized = []
        for row in rows:
            transaction, cash, trade, stock, deposit, bond = row
            factor = ONE
            if trade is not None:
                for when, ratio in split_events.get(trade.stock_id, {}).items():
                    if transaction.date < date.fromisoformat(when) <= today:
                        factor *= Decimal(ratio)
                if factor != ONE:
                    # Yahoo Close already uses post-split units. Keep actual
                    # execution totals while expressing volumes in that basis.
                    actual_value = operation_from_row(row).value
                    trade = SimpleNamespace(
                        stock_id=trade.stock_id,
                        volume=trade.volume * factor,
                        price_per_unit=trade.price_per_unit / factor,
                        total_value=actual_value,
                    )
            normalized.append((transaction, cash, trade, stock, deposit, bond))
        rows = normalized

    # Include sold instruments: they still contribute to historical valuations.
    market, manual = stock_prices(
        db,
        user_id,
        [row[2].stock_id for row in rows if row[2] is not None],
        history=True,
    )
    if split_events:
        normalized_manual = []
        for price in manual:
            factor = ONE
            for when, ratio in split_events.get(price.stock_id, {}).items():
                if price.price_date < date.fromisoformat(when) <= today:
                    factor *= Decimal(ratio)
            normalized_manual.append(
                SimpleNamespace(
                    stock_id=price.stock_id,
                    price_date=price.price_date,
                    price=price.price / factor,
                    currency=price.currency,
                )
            )
        manual = normalized_manual
    if closed_prices_only:
        market = [
            price
            for price in market
            if price.price_date < datetime.now(timezone.utc).date()
        ]
    historical_rates = ExchangeRateHistory(exchange_rates(db))
    bonds = BondValuator(
        *bond_valuation_sources(
            db, (row[5].series_code for row in rows if row[5] is not None), today
        )
    )
    flows = external_flows(rows, historical_rates)
    start = max(min(row[0].date for row in rows), range_start(today, selected_range))
    # Keep one preceding snapshot for the first flow-adjusted daily return.
    on = start - timedelta(days=1) if start > date.min else start
    observations = [
        iter(sorted(prices, key=lambda price: price.price_date))
        for prices in (market, manual)
    ]
    pending = [next(prices, None) for prices in observations]
    latest = [{}, {}]
    ledger = PortfolioLedger(historical_rates, bonds)
    operations = iter(rows)
    pending_operation = next(operations, None)
    previous_value, previous_income = None, ZERO
    series: list[PortfolioPoint] = []
    returns: list[Decimal | None] = []
    contribution = (
        sum((flow for when, flow in flows.items() if when < start), ZERO)
        if all(flow is not None for when, flow in flows.items() if when < start)
        else None
    )
    next_progress = monotonic()
    while on <= today:
        if on_progress is not None and monotonic() >= next_progress:
            on_progress()
            next_progress = monotonic() + 10
        # Rows are ordered by date and ledger order by the repository. Each
        # operation changes the retained state exactly once, on its own date.
        while pending_operation is not None and pending_operation[0].date <= on:
            ledger.apply(pending_operation)
            pending_operation = next(operations, None)
        for index, prices in enumerate(observations):
            price = pending[index]
            while price is not None and price.price_date <= on:
                latest[index][price.stock_id] = price
                price = next(prices, None)
            pending[index] = price
        daily = ledger.snapshot(
            list(latest[0].values()),
            list(latest[1].values()),
            on,
        )
        value = (
            sum((holding.value for holding in daily), ZERO)
            if all(holding.value is not None for holding in daily)
            else None
        )
        income = sum((holding.paid_interest or ZERO for holding in daily), ZERO)
        if on >= start:
            flow = flows.get(on, ZERO)
            daily_return = (
                (value + income - previous_income - flow) / previous_value - ONE
                if value is not None
                and previous_value is not None
                and previous_value > ZERO
                and flow is not None
                else None
            )
            contribution = (
                contribution + flow
                if contribution is not None and flow is not None
                else None
            )
            series.append(
                PortfolioPoint(
                    date=on,
                    value=value,
                    contribution=contribution,
                    daily_return=daily_return,
                )
            )
            returns.append(daily_return)
        previous_value, previous_income = value, income
        on += timedelta(days=1)
    # An initial investment has no preceding capital and therefore no return.
    if start == min(row[0].date for row in rows):
        returns = returns[1:]
    result = statistics_from_holdings(
        rows, historical_rates, daily, today, selected_range
    )
    result.series = series
    result.performance = performance_statistics(series, returns)
    return result


def portfolio_dashboard(db: Session, user_id: UUID) -> PortfolioDashboard:
    from app.services.xtb_history import history_operations

    rows, rates, holdings, today = load_portfolio(db, user_id)
    return PortfolioDashboard(
        kpi=statistics_from_holdings(rows, rates, holdings, today).kpi,
        holdings=holdings,
        allocation=allocation_from_holdings(holdings),
        operations=history_operations(db, user_id, rows, rates),
    )


def external_flows(rows, rates: ExchangeRateHistory) -> dict[date, Decimal | None]:
    flows: dict[date, Decimal | None] = defaultdict(lambda: ZERO)
    for row in rows:
        transaction = row[0]
        if transaction.external_flow is False:
            continue
        operation = operation_from_row(row)
        fx = exchange_rate_on(rates, transaction.currency, transaction.date)
        previous = flows[transaction.date]
        if previous is None or operation.value is None or fx is None:
            flows[transaction.date] = None
        else:
            sign = ONE if transaction.type == TransactionType.buy else -ONE
            flows[transaction.date] = previous + sign * operation.value * fx
    return dict(flows)


def statistics_from_holdings(
    rows,
    rates: ExchangeRateHistory,
    holdings: list[Holding],
    today: date,
    selected_range: PortfolioRange = "1R",
) -> PortfolioStatistics:
    flows = external_flows(rows, rates)
    total_contrib = (
        sum((value for value in flows.values() if value is not None), ZERO)
        if all(value is not None for value in flows.values())
        else None
    )

    total_value = (
        sum((holding.value for holding in holdings if holding.value is not None), ZERO)
        if all(holding.value is not None for holding in holdings)
        else None
    )
    balance = (
        total_value
        + sum((holding.paid_interest or ZERO for holding in holdings), ZERO)
        - total_contrib
        if total_value is not None and total_contrib is not None
        else None
    )
    # Coupons leave the bond, so include their actual scheduled dates in XIRR
    # without treating investment income as a reduction of contributed capital.
    return_flows = dict(flows)
    for holding in holdings:
        for payment in holding.income_payments:
            previous = return_flows.get(payment.date, ZERO)
            return_flows[payment.date] = (
                previous - payment.amount if previous is not None else None
            )
    kpi = PortfolioKpi(
        as_of_date=today,
        total_contrib=total_contrib,
        total_value=total_value,
        balance=balance,
        roi=balance / total_contrib * 100
        if balance is not None and total_contrib is not None and total_contrib > ZERO
        else None,
        xirr=xirr(return_flows, total_value, today),
        unvalued_count=sum(h.value is None for h in holdings),
    )
    return PortfolioStatistics(
        range=selected_range,
        kpi=kpi,
        series=[],
        performance=None,
    )
