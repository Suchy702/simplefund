"""cash operation constraints and transaction index

Revision ID: 56427c4d60ee
Revises: 64919006ab45
Create Date: 2026-10-22 21:34:45.641243

"""

from typing import Sequence, Union

from alembic import op

revision: str = "56427c4d60ee"
down_revision: Union[str, None] = "64919006ab45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_cash_value_positive", "cash_transactions", "value > 0"
    )
    op.create_index("ix_transactions_user_date", "transactions", ["user_id", "date"])


def downgrade() -> None:
    op.drop_index("ix_transactions_user_date", table_name="transactions")
    op.drop_constraint("ck_cash_value_positive", "cash_transactions", type_="check")
