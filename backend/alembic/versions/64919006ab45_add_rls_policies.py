"""add rls policies

Revision ID: 64919006ab45
Revises: ca00fe809b4e
Create Date: 2026-05-27 22:53:31.184634

"""

from typing import Sequence, Union

from alembic import op

revision: str = "64919006ab45"
down_revision: Union[str, None] = "ca00fe809b4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable RLS
    op.execute("ALTER TABLE profiles ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE transactions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE deposit_transactions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE bond_transactions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE manual_prices ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE stocks ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE bond_series ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE asset_prices ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY")

    op.execute("""
        CREATE POLICY "users see own profile" ON profiles
        FOR ALL USING (id = auth.uid())
    """)

    op.execute("""
        CREATE POLICY "users see own transactions" ON transactions
        FOR ALL USING (user_id = auth.uid())
    """)

    for table in (
        "stock_transactions",
        "deposit_transactions",
        "bond_transactions",
        "cash_transactions",
    ):
        op.execute(f"""
            CREATE POLICY "users see own {table}" ON {table}
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM transactions t
                    WHERE t.id = transaction_id AND t.user_id = auth.uid()
                )
            )
        """)

    op.execute("""
        CREATE POLICY "users see own manual prices" ON manual_prices
        FOR ALL USING (user_id = auth.uid())
    """)

    for table in ("stocks", "bond_series", "asset_prices", "exchange_rates"):
        op.execute(f"""
            CREATE POLICY "public read {table}" ON {table}
            FOR SELECT USING (true)
        """)


def downgrade() -> None:
    op.execute('DROP POLICY IF EXISTS "users see own profile" ON profiles')
    op.execute('DROP POLICY IF EXISTS "users see own transactions" ON transactions')

    for table in (
        "stock_transactions",
        "deposit_transactions",
        "bond_transactions",
        "cash_transactions",
    ):
        op.execute(f'DROP POLICY IF EXISTS "users see own {table}" ON {table}')

    op.execute('DROP POLICY IF EXISTS "users see own manual prices" ON manual_prices')

    for table in ("stocks", "bond_series", "asset_prices", "exchange_rates"):
        op.execute(f'DROP POLICY IF EXISTS "public read {table}" ON {table}')

    for table in (
        "profiles",
        "transactions",
        "stock_transactions",
        "deposit_transactions",
        "bond_transactions",
        "cash_transactions",
        "manual_prices",
        "stocks",
        "bond_series",
        "asset_prices",
        "exchange_rates",
    ):
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
