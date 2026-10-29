from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.portfolio import (
    ApiModel,
    PerformanceStatistics,
    PortfolioPoint,
    PortfolioRange,
)


class HistoryRequest(ApiModel):
    # Retain null compatibility with older clients; comparisons are disabled.
    benchmark: None = None


class HistoryResponse(ApiModel):
    status: Literal["idle", "running", "ready", "error"] = "idle"
    calculated_at: datetime | None = None
    next_calculation_at: datetime | None = None
    server_time: datetime
    stale: bool = False
    error: str | None = None
    warnings: list[str] = Field(default_factory=list)
    benchmark: None = None
    range: PortfolioRange = "1R"
    series: list[PortfolioPoint] = Field(default_factory=list)
    performance: PerformanceStatistics | None = None
