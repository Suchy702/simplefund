"""Add staged XTB imports, user mappings and idempotent source identities.

Revision ID: c81a7d26f430
Revises: 7a1d9e4c8b20
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c81a7d26f430"
down_revision = "7a1d9e4c8b20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing manual rows have NULL external_id and retain their previous behavior.
    # Existing duplicate non-NULL identities fail explicitly, never delete history.
    op.create_unique_constraint(
        "uq_transactions_user_external", "transactions", ["user_id", "external_id"]
    )
    op.add_column(
        "transactions",
        sa.Column(
            "external_flow", sa.Boolean(), server_default=sa.true(), nullable=False
        ),
    )
    op.add_column("transactions", sa.Column("source_label", sa.String(100)))
    op.add_column("stock_transactions", sa.Column("total_value", sa.Numeric(18, 2)))
    op.create_table(
        "xtb_mappings",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("profiles.id"), primary_key=True),
        sa.Column("source_ticker", sa.String(64), primary_key=True),
        sa.Column("choice", postgresql.JSONB(), nullable=False),
    )
    op.create_table(
        "xtb_imports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
    )
    op.create_index("ix_xtb_imports_user_id", "xtb_imports", ["user_id"])
    op.create_table(
        "xtb_events",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("profiles.id"), primary_key=True),
        sa.Column("external_id", sa.String(160), primary_key=True),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
    )
    for table in ("xtb_mappings", "xtb_imports", "xtb_events"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        # All writes go through the authenticated backend and its ledger lock.
        op.execute(f"REVOKE ALL ON {table} FROM anon, authenticated")


def downgrade() -> None:
    # Refuse rollback while imported ledger rows rely on the added accounting data.
    op.execute("LOCK TABLE transactions IN ACCESS EXCLUSIVE MODE")
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM transactions WHERE external_id LIKE 'xtb:%') THEN
                RAISE EXCEPTION 'Cannot downgrade while XTB transactions exist';
            END IF;
        END $$
    """)
    op.drop_table("xtb_events")
    op.drop_table("xtb_imports")
    op.drop_table("xtb_mappings")
    op.drop_column("stock_transactions", "total_value")
    op.drop_column("transactions", "source_label")
    op.drop_column("transactions", "external_flow")
    op.drop_constraint("uq_transactions_user_external", "transactions", type_="unique")
