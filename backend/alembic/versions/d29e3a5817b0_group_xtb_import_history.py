"""Retain committed XTB imports and associate ledger and source rows with them.

Revision ID: d29e3a5817b0
Revises: d24b8c6e310f
"""

import sqlalchemy as sa
from alembic import op

revision = "d29e3a5817b0"
down_revision = "d24b8c6e310f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column("xtb_imports", sa.Column("committed_at", sa.DateTime(timezone=True)))
    for table in ("transactions", "xtb_events"):
        op.add_column(table, sa.Column("xtb_import_id", sa.Uuid()))
        op.create_foreign_key(
            f"fk_{table}_xtb_import", table, "xtb_imports", ["xtb_import_id"], ["id"]
        )
        op.create_index(f"ix_{table}_xtb_import_id", table, ["xtb_import_id"])
    # Historical imports did not retain batch membership. Recover one group per
    # user/account/currency without inventing original file or upload boundaries.
    op.execute("""
        INSERT INTO xtb_imports (id, user_id, expires_at, committed_at, payload)
        SELECT gen_random_uuid(), e.user_id, now(), now(),
               jsonb_build_object(
                   'legacy', true, 'revision', 1,
                   'accounts', jsonb_build_array(jsonb_build_object(
                       'account', e.payload->'source'->>'account',
                       'currency', e.payload->>'currency',
                       'filename', 'Wcześniejszy import XTB — rachunek ' ||
                                   (e.payload->'source'->>'account')
                   ))
               )
        FROM xtb_events e
        GROUP BY e.user_id, e.payload->'source'->>'account', e.payload->>'currency'
    """)
    op.execute("""
        UPDATE xtb_events e SET xtb_import_id = i.id
        FROM xtb_imports i
        WHERE i.user_id = e.user_id AND i.payload->>'legacy' = 'true'
          AND i.payload->'accounts'->0->>'account' = e.payload->'source'->>'account'
          AND i.payload->'accounts'->0->>'currency' = e.payload->>'currency'
    """)
    op.execute("""
        UPDATE transactions t SET xtb_import_id = e.xtb_import_id
        FROM xtb_events e
        WHERE t.user_id = e.user_id
          AND regexp_replace(t.external_id, '[:]trade$', '') = e.external_id
    """)
    op.execute("""
        UPDATE xtb_events e SET payload = e.payload || jsonb_build_object(
            'cash_imported', EXISTS (
                SELECT 1 FROM transactions t
                WHERE t.user_id = e.user_id AND t.external_id = e.external_id
            )
        )
    """)


def downgrade() -> None:
    # Preserve all ledger data and retained previews; only remove the grouping.
    for table in ("xtb_events", "transactions"):
        op.drop_index(f"ix_{table}_xtb_import_id", table_name=table)
        op.drop_constraint(f"fk_{table}_xtb_import", table, type_="foreignkey")
        op.drop_column(table, "xtb_import_id")
    op.drop_column("xtb_imports", "committed_at")
