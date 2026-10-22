"""add profile roles

Revision ID: 3a9b2beec860
Revises: 56427c4d60ee
Create Date: 2026-10-22 22:31:12.703524

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "3a9b2beec860"
down_revision: Union[str, None] = "56427c4d60ee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column("role", sa.String(), server_default="user", nullable=False),
    )
    op.create_check_constraint(
        "ck_profiles_role", "profiles", "role IN ('user', 'admin')"
    )
    # RLS limits rows, but users must also be prevented from promoting themselves.
    op.execute("REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated")
    op.execute("""
        GRANT INSERT (id, email, created_at, updated_at),
              UPDATE (id, email, created_at, updated_at)
        ON public.profiles TO anon, authenticated
    """)


def downgrade() -> None:
    op.execute("""
        REVOKE INSERT (id, email, created_at, updated_at),
               UPDATE (id, email, created_at, updated_at)
        ON public.profiles FROM anon, authenticated
    """)
    op.execute("GRANT INSERT, UPDATE ON public.profiles TO anon, authenticated")
    op.drop_constraint("ck_profiles_role", "profiles", type_="check")
    op.drop_column("profiles", "role")
