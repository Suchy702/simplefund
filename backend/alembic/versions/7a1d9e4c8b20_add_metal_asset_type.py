"""Add the metal asset type, reusing the existing instrument ledger.

Revision ID: 7a1d9e4c8b20
Revises: 91f78f7e22d0
"""

from alembic import op

revision = "7a1d9e4c8b20"
down_revision = "91f78f7e22d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This revision does not use the new value before its transaction commits.
    op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'metal'")


def downgrade() -> None:
    # Never delete trades to make a rollback possible. The cast below also rejects
    # any metal rows, and the lock prevents writes between the guard and the cast.
    op.execute("LOCK TABLE transactions IN ACCESS EXCLUSIVE MODE")
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM transactions WHERE asset_type::text = 'metal') THEN
                RAISE EXCEPTION 'Cannot downgrade while metal transactions exist';
            END IF;
        END $$
    """)
    op.execute(
        "CREATE TYPE assettype_without_metal AS ENUM "
        "('stock', 'deposit', 'bond', 'cash')"
    )
    op.execute(
        "ALTER TABLE transactions ALTER COLUMN asset_type "
        "TYPE assettype_without_metal "
        "USING asset_type::text::assettype_without_metal"
    )
    op.execute("DROP TYPE assettype")
    op.execute("ALTER TYPE assettype_without_metal RENAME TO assettype")
