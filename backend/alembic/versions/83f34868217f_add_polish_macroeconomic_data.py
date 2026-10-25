"""add polish macroeconomic data

Revision ID: 83f34868217f
Revises: e38f7a21b640
Create Date: 2026-10-25 17:39:07.873893

"""

import sqlalchemy as sa
from alembic import op

revision = "83f34868217f"
down_revision = "e38f7a21b640"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "nbp_reference_rates",
        sa.Column("effective_from", sa.Date(), primary_key=True),
        sa.Column("rate_pct", sa.Numeric(7, 4), nullable=False),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "rate_pct >= 0 AND rate_pct < 100", name="ck_nbp_rate_range"
        ),
    )
    op.create_table(
        "polish_inflation",
        sa.Column("month", sa.Date(), primary_key=True),
        sa.Column("rate_pct", sa.Numeric(9, 4), nullable=False),
        sa.Column("source_flag", sa.String(), nullable=False),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "EXTRACT(DAY FROM month) = 1", name="ck_inflation_month_start"
        ),
        sa.CheckConstraint(
            "rate_pct > -100 AND rate_pct < 10000", name="ck_inflation_range"
        ),
    )
    for table in ("nbp_reference_rates", "polish_inflation"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON TABLE {table} FROM PUBLIC, anon, authenticated")
        op.execute(f"GRANT SELECT ON TABLE {table} TO anon, authenticated")
        op.execute(
            f'CREATE POLICY "public read {table}" ON {table} '
            "FOR SELECT TO anon, authenticated USING (true)"
        )


def downgrade() -> None:
    op.drop_table("polish_inflation")
    op.drop_table("nbp_reference_rates")
