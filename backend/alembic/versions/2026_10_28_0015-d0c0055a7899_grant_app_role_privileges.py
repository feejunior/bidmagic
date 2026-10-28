"""grant app role privileges

Revision ID: d0c0055a7899
Revises: f1af0cd93138
Create Date: 2026-10-28 00:15:07.197582

"""

from collections.abc import Sequence

from alembic import op
from app.core.config import settings

revision: str = "d0c0055a7899"
down_revision: str | Sequence[str] | None = "f1af0cd93138"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PRIVILEGES = {
    "users": "SELECT, INSERT, UPDATE",
    "cards": "SELECT, INSERT, UPDATE",
    "lots": "SELECT, INSERT, UPDATE",
    "bids": "SELECT, INSERT",
    "ledger_entries": "SELECT, INSERT",
    "receipts": "SELECT, INSERT",
}


def upgrade() -> None:
    role = f'"{settings.app_db_user}"'
    for table, privileges in PRIVILEGES.items():
        op.execute(f"GRANT {privileges} ON {table} TO {role}")
    op.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {role}")


def downgrade() -> None:
    role = f'"{settings.app_db_user}"'
    for table in PRIVILEGES:
        op.execute(f"REVOKE ALL ON {table} FROM {role}")
    op.execute(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {role}")
