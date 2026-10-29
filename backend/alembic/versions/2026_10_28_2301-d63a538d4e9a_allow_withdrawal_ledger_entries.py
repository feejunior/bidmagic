"""allow withdrawal ledger entries

Revision ID: d63a538d4e9a
Revises: d0c0055a7899
Create Date: 2026-10-28 23:01:35.012374

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd63a538d4e9a'
down_revision: Union[str, Sequence[str], None] = 'd0c0055a7899'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_ledger_entries_type"), "ledger_entries", type_="check")
    op.create_check_constraint(
        op.f("ck_ledger_entries_type"),
        "ledger_entries",
        "type IN ('deposit', 'withdrawal', 'purchase', 'sale')",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_ledger_entries_type"), "ledger_entries", type_="check")
    op.create_check_constraint(
        op.f("ck_ledger_entries_type"),
        "ledger_entries",
        "type IN ('deposit', 'purchase', 'sale')",
    )
