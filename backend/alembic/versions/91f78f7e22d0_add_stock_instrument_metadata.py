"""add stock instrument metadata

Revision ID: 91f78f7e22d0
Revises: 3a9b2beec860
Create Date: 2026-10-23 21:35:57.978526

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "91f78f7e22d0"
down_revision: Union[str, None] = "3a9b2beec860"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("stocks", sa.Column("exchange", sa.String(), nullable=True))
    op.add_column("stocks", sa.Column("quote_type", sa.String(), nullable=True))
    op.create_index(
        "ix_stock_transactions_stock_id", "stock_transactions", ["stock_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_stock_transactions_stock_id", table_name="stock_transactions")
    op.drop_column("stocks", "quote_type")
    op.drop_column("stocks", "exchange")
