from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Card, LedgerEntry, Lot, User

ENTRIES_LIMIT = 50


async def get_balance(session: AsyncSession, user_id: int) -> tuple[int, int]:
    total = await session.scalar(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
            LedgerEntry.user_id == user_id
        )
    )
    committed = await session.scalar(
        select(func.coalesce(func.sum(Lot.current_bid), 0)).where(
            Lot.leader_id == user_id, Lot.status == "active"
        )
    )
    return total, committed


async def get_available(session: AsyncSession, user_id: int) -> int:
    total, committed = await get_balance(session, user_id)
    return total - committed


async def deposit(session: AsyncSession, user: User, amount: int) -> None:
    await session.execute(select(User.id).where(User.id == user.id).with_for_update())
    session.add(LedgerEntry(user_id=user.id, type="deposit", amount=amount))
    await session.commit()


async def get_wallet(session: AsyncSession, user: User) -> dict[str, Any]:
    total, committed = await get_balance(session, user.id)
    entries = await session.execute(
        select(LedgerEntry, Card.name)
        .outerjoin(Lot, Lot.id == LedgerEntry.lot_id)
        .outerjoin(Card, Card.id == Lot.card_id)
        .where(LedgerEntry.user_id == user.id)
        .order_by(LedgerEntry.id.desc())
        .limit(ENTRIES_LIMIT)
    )
    return {
        "total": total,
        "committed": committed,
        "available": total - committed,
        "entries": [
            {
                "id": entry.id,
                "type": entry.type,
                "amount": entry.amount,
                "lot_id": entry.lot_id,
                "card_name": card_name,
                "created_at": entry.created_at,
            }
            for entry, card_name in entries
        ],
    }
