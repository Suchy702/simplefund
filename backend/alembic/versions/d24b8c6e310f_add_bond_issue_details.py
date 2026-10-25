"""Add nullable issue terms while preserving existing bond rows and references.

Revision ID: d24b8c6e310f
Revises: c81a7d26f430
"""

import sqlalchemy as sa
from alembic import op

revision = "d24b8c6e310f"
down_revision = "c81a7d26f430"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    columns = [
        sa.Column("family", sa.String()),
        sa.Column("sale_start", sa.Date()),
        sa.Column("sale_end", sa.Date()),
        sa.Column("term_months", sa.Integer()),
        sa.Column("fixed_rate_pct", sa.Numeric(7, 4)),
        sa.Column("first_period_rate_pct", sa.Numeric(7, 4)),
        sa.Column("inflation_margin_pp", sa.Numeric(7, 4)),
        sa.Column("capitalization", sa.String()),
        sa.Column("interest_payment", sa.String()),
        sa.Column("source_url", sa.String()),
        sa.Column("issue_letter_url", sa.String()),
        sa.Column("imported_at", sa.DateTime(timezone=True)),
    ]
    for column in columns:
        op.add_column("bond_series", column)
    op.create_check_constraint(
        "ck_bond_series_sale_dates", "bond_series", "sale_end >= sale_start"
    )
    op.create_check_constraint("ck_bond_series_term", "bond_series", "term_months > 0")
    op.create_check_constraint(
        "ck_bond_series_rates",
        "bond_series",
        "fixed_rate_pct >= 0 AND first_period_rate_pct >= 0 "
        "AND inflation_margin_pp >= 0",
    )


def downgrade() -> None:
    for name in ("rates", "term", "sale_dates"):
        op.drop_constraint(f"ck_bond_series_{name}", "bond_series", type_="check")
    for name in (
        "imported_at",
        "issue_letter_url",
        "source_url",
        "interest_payment",
        "capitalization",
        "inflation_margin_pp",
        "first_period_rate_pct",
        "fixed_rate_pct",
        "term_months",
        "sale_end",
        "sale_start",
        "family",
    ):
        op.drop_column("bond_series", name)
