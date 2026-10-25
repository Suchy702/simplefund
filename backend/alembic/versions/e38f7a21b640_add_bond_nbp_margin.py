"""Add NBP-linked bond margins independently of pending XTB changes.

Revision ID: e38f7a21b640
Revises: d24b8c6e310f
"""

import sqlalchemy as sa
from alembic import op

revision = "e38f7a21b640"
down_revision = "d24b8c6e310f"
branch_labels = ("bond_nbp_terms",)
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column("bond_series", sa.Column("nbp_margin_pp", sa.Numeric(7, 4)))
    op.create_check_constraint(
        "ck_bond_series_nbp_margin", "bond_series", "nbp_margin_pp >= 0"
    )


def downgrade() -> None:
    op.drop_constraint("ck_bond_series_nbp_margin", "bond_series", type_="check")
    op.drop_column("bond_series", "nbp_margin_pp")
