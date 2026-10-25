"""Add cryptocurrency trades and preserve small token prices.

Revision ID: f52e8c9a410b
Revises: d77f4f818b3b
"""

import sqlalchemy as sa
from alembic import op

revision = "f52e8c9a410b"
down_revision = "d77f4f818b3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'crypto'")
    op.alter_column(
        "asset_prices",
        "price",
        existing_type=sa.Numeric(18, 4),
        type_=sa.Numeric(26, 12),
        existing_nullable=False,
    )
    op.alter_column(
        "stock_transactions",
        "price_per_unit",
        existing_type=sa.Numeric(18, 4),
        type_=sa.Numeric(26, 12),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Reject rollback rather than deleting trades or rounding stored prices.
    op.execute(
        "LOCK TABLE transactions, stock_transactions, asset_prices "
        "IN ACCESS EXCLUSIVE MODE"
    )
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM transactions WHERE asset_type::text = 'crypto'
            ) THEN
                RAISE EXCEPTION 'Cannot downgrade while crypto transactions exist';
            END IF;
            IF EXISTS (SELECT 1 FROM asset_prices WHERE price <> round(price, 4))
                OR EXISTS (
                    SELECT 1 FROM stock_transactions
                    WHERE price_per_unit <> round(price_per_unit, 4)
                ) THEN
                RAISE EXCEPTION 'Cannot downgrade without losing price precision';
            END IF;
        END $$
    """)
    op.alter_column(
        "asset_prices",
        "price",
        existing_type=sa.Numeric(26, 12),
        type_=sa.Numeric(18, 4),
        existing_nullable=False,
    )
    op.alter_column(
        "stock_transactions",
        "price_per_unit",
        existing_type=sa.Numeric(26, 12),
        type_=sa.Numeric(18, 4),
        existing_nullable=False,
    )
    op.execute(
        "CREATE TYPE assettype_without_crypto AS ENUM "
        "('stock', 'metal', 'deposit', 'bond', 'cash')"
    )
    op.execute(
        "ALTER TABLE transactions ALTER COLUMN asset_type "
        "TYPE assettype_without_crypto "
        "USING asset_type::text::assettype_without_crypto"
    )
    op.execute("DROP TYPE assettype")
    op.execute("ALTER TYPE assettype_without_crypto RENAME TO assettype")
