import asyncio
import logging
import secrets
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal
from app.models import LedgerEntry, Lot, Receipt, User
from app.services.lots import utcnow

SETTLEMENT_INTERVAL_SECONDS = 2

logger = logging.getLogger(__name__)


async def settle_lot(session: AsyncSession, lot_id: int) -> dict[str, Any] | None:
    lot = await session.scalar(select(Lot).where(Lot.id == lot_id).with_for_update())
    now = utcnow()
    if lot is None or lot.status != "active" or lot.ends_at > now:
        return None

    lot.status = "closed"
    lot.closed_at = now

    if lot.leader_id is None:
        await session.commit()
        return {"lot_id": lot.id, "winner_alias": None, "final_amount": None}

    users = await session.scalars(
        select(User)
        .where(User.id.in_({lot.leader_id, lot.auctioneer_id}))
        .order_by(User.id)
        .with_for_update()
    )
    winner = next(user for user in users if user.id == lot.leader_id)

    session.add_all(
        [
            LedgerEntry(
                user_id=lot.leader_id,
                type="purchase",
                amount=-lot.current_bid,
                lot_id=lot.id,
            ),
            LedgerEntry(
                user_id=lot.auctioneer_id,
                type="sale",
                amount=lot.current_bid,
                lot_id=lot.id,
            ),
            Receipt(
                lot_id=lot.id,
                winner_id=lot.leader_id,
                final_amount=lot.current_bid,
                public_code=secrets.token_urlsafe(16),
                last_hash=lot.last_hash,
            ),
        ]
    )
    await session.commit()
    return {
        "lot_id": lot.id,
        "winner_alias": winner.alias,
        "final_amount": lot.current_bid,
    }


async def settle_due_lots() -> list[dict[str, Any]]:
    async with SessionLocal() as session:
        due_ids = await session.scalars(
            select(Lot.id).where(Lot.status == "active", Lot.ends_at <= utcnow())
        )
        due_ids = list(due_ids)

    results = []
    for lot_id in due_ids:
        try:
            async with SessionLocal() as session:
                result = await settle_lot(session, lot_id)
        except Exception:
            logger.exception("Failed to settle lot %s", lot_id)
            continue
        if result:
            results.append(result)
    return results


async def settlement_loop() -> None:
    while True:
        try:
            await settle_due_lots()
        except Exception:
            logger.exception("Settlement round failed")
        await asyncio.sleep(SETTLEMENT_INTERVAL_SECONDS)
