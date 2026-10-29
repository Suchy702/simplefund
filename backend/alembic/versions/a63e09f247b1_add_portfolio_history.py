"""Persist on-demand portfolio history and shared source coverage.

Revision ID: a63e09f247b1
Revises: f52e8c9a410b
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a63e09f247b1"
down_revision = "f52e8c9a410b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_history",
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="idle"),
        sa.Column("job_id", sa.UUID()),
        sa.Column("requested_at", sa.DateTime(timezone=True)),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True)),
        sa.Column("calculated_at", sa.DateTime(timezone=True)),
        sa.Column("error", sa.String(500)),
        sa.Column("payload", postgresql.JSONB()),
        sa.CheckConstraint(
            "status IN ('idle', 'running', 'ready', 'error')",
            name="ck_portfolio_history_status",
        ),
    )
    op.create_table(
        "history_source_cache",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("payload", postgresql.JSONB()),
        sa.Column("lease_id", sa.UUID()),
        sa.Column("busy_until", sa.DateTime(timezone=True)),
        sa.Column("retry_after", sa.DateTime(timezone=True)),
        sa.Column("error", sa.String(500)),
    )
    # Only the backend may read/write job state, limits and shared observations.
    # No browser grants or policies: RLS defaults to denying direct Data API access.
    for table in ("portfolio_history", "history_source_cache"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON TABLE {table} FROM anon, authenticated")


def downgrade() -> None:
    op.drop_table("history_source_cache")
    op.drop_table("portfolio_history")
