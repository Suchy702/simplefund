from datetime import datetime
from typing import Literal
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PortfolioHistory(Base):
    __tablename__ = "portfolio_history"
    __table_args__ = (
        CheckConstraint(
            "status IN ('idle', 'running', 'ready', 'error')",
            name="ck_portfolio_history_status",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True
    )
    status: Mapped[Literal["idle", "running", "ready", "error"]] = mapped_column(
        String(16), nullable=False, default="idle", server_default="idle"
    )
    job_id: Mapped[UUID | None]
    requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    calculated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(String(500))
    payload: Mapped[dict | None] = mapped_column(JSONB)


class HistorySourceCache(Base):
    """Public observations only; private valuations never enter this cache."""

    __tablename__ = "history_source_cache"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    lease_id: Mapped[UUID | None]
    busy_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retry_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(String(500))
