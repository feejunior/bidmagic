from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Bid, Lot, Receipt, User
from app.rules.audit import bid_hash, genesis_hash, lot_seal
from app.rules.bidding import calculate_new_end, minimum_bid, validate_bid
from app.services.lots import lot_not_found, lot_query, to_summary, utcnow
from app.services.wallet import get_available


async def place_bid(
    session: AsyncSession, user: User, lot_id: int, amount: int
) -> dict[str, Any]:
    lot = await session.scalar(select(Lot).where(Lot.id == lot_id).with_for_update())
    if lot is None:
        raise lot_not_found()
    bidder = await session.scalar(
        select(User).where(User.id == user.id).with_for_update()
    )

    available = await get_available(session, bidder.id)
    now = utcnow()
    validate_bid(lot, bidder, amount, available, now)

    key = settings.audit_hmac_key
    prev_hash = lot.last_hash or genesis_hash(key, lot.id)
    bid = Bid(
        lot_id=lot.id,
        bidder_id=bidder.id,
        amount=amount,
        created_at=now,
        prev_hash=prev_hash,
        hash=bid_hash(key, lot.id, bidder.id, amount, now, prev_hash),
    )
    session.add(bid)

    lot.current_bid = amount
    lot.leader_id = bidder.id
    lot.bid_count += 1
    lot.last_hash = bid.hash
    lot.seal = lot_seal(key, lot.id, lot.bid_count, bid.hash)
    lot.ends_at = calculate_new_end(
        lot.ends_at, now, settings.anti_sniping_extend_from_end
    )
    await session.commit()

    return {
        "lot_id": lot.id,
        "amount": amount,
        "bidder_alias": bidder.alias,
        "created_at": now,
        "ends_at": lot.ends_at,
        "bid_count": lot.bid_count,
        "minimum_bid": minimum_bid(lot),
        "server_now": utcnow(),
    }


async def get_my_bids(session: AsyncSession, user: User) -> dict[str, Any]:
    highest = (
        select(Bid.lot_id, func.max(Bid.amount).label("my_highest_bid"))
        .where(Bid.bidder_id == user.id)
        .group_by(Bid.lot_id)
        .subquery()
    )
    rows = await session.execute(
        lot_query()
        .add_columns(highest.c.my_highest_bid, Receipt.public_code)
        .join(highest, highest.c.lot_id == Lot.id)
        .outerjoin(Receipt, (Receipt.lot_id == Lot.id) & (Receipt.winner_id == user.id))
        .order_by(Lot.ends_at.desc(), Lot.id.desc())
    )

    now = utcnow()
    return {
        "server_now": now,
        "items": [
            {
                "lot": to_summary(row[:4], now),
                "my_highest_bid": row[4],
                "is_leader": row[0].leader_id == user.id,
                "receipt_code": row[5],
            }
            for row in rows
        ],
    }
