import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'admin')", name="ck_profiles_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    role: Mapped[str] = mapped_column(
        String, nullable=False, default="user", server_default="user"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
