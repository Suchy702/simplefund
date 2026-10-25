"""User-owned XTB mappings, staged previews and source event identities."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class XtbMapping(Base):
    __tablename__ = "xtb_mappings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id"), primary_key=True
    )
    source_ticker: Mapped[str] = mapped_column(String(64), primary_key=True)
    choice: Mapped[dict] = mapped_column(JSONB, nullable=False)


class XtbImport(Base):
    __tablename__ = "xtb_imports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    committed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)


class XtbEvent(Base):
    __tablename__ = "xtb_events"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id"), primary_key=True
    )
    external_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    xtb_import_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("xtb_imports.id"), index=True
    )
    # Keep the source event to detect changed reports and audit derived cash legs.
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
