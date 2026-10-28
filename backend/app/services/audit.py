import hmac
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.core.errors import AppError
from app.models import Bid, Card, Lot, Receipt, User
from app.rules.audit import genesis_hash, verify_chain
from app.services.lots import lot_not_found, lot_status, to_summary, utcnow

Winner = aliased(User)
Auctioneer = aliased(User)


async def get_receipt(session: AsyncSession, public_code: str) -> dict[str, Any]:
    row = (
        await session.execute(
            select(Receipt, Lot, Card, Auctioneer.alias, Winner.alias)
            .join(Lot, Lot.id == Receipt.lot_id)
            .join(Card, Card.id == Lot.card_id)
            .join(Auctioneer, Auctioneer.id == Lot.auctioneer_id)
            .join(Winner, Winner.id == Receipt.winner_id)
            .where(Receipt.public_code == public_code)
        )
    ).first()
    if row is None:
        raise AppError("RECEIPT_NOT_FOUND", "Comprovante não encontrado.", 404)

    receipt, lot, card, auctioneer_alias, winner_alias = row
    summary = to_summary((lot, card, auctioneer_alias, winner_alias), utcnow())
    return {
        "public_code": receipt.public_code,
        "lot_id": lot.id,
        "card": summary["card"],
        "auctioneer_alias": auctioneer_alias,
        "winner_alias": winner_alias,
        "final_amount": receipt.final_amount,
        "last_hash": receipt.last_hash,
        "issued_at": receipt.issued_at,
    }


async def audit_lot(session: AsyncSession, lot_id: int) -> dict[str, Any]:
    row = (
        await session.execute(
            select(Lot, Card.name)
            .join(Card, Card.id == Lot.card_id)
            .where(Lot.id == lot_id)
        )
    ).first()
    if row is None:
        raise lot_not_found()
    lot, card_name = row

    rows = (
        await session.execute(
            select(Bid, User.alias)
            .join(User, User.id == Bid.bidder_id)
            .where(Bid.lot_id == lot_id)
            .order_by(Bid.id)
        )
    ).all()
    bids = [bid for bid, _ in rows]

    key = settings.audit_hmac_key
    check = verify_chain(key, lot.id, bids, lot.seal)

    receipt_hash = await session.scalar(
        select(Receipt.last_hash).where(Receipt.lot_id == lot.id)
    )
    receipt_hash_valid = None
    if receipt_hash is not None:
        expected = bids[-1].hash if bids else ""
        receipt_hash_valid = hmac.compare_digest(receipt_hash, expected)

    return {
        "lot_id": lot.id,
        "card_name": card_name,
        "status": lot_status(lot, utcnow()),
        "bid_count": lot.bid_count,
        "genesis_hash": genesis_hash(key, lot.id),
        "last_hash": lot.last_hash,
        "seal": lot.seal,
        "seal_valid": check.seal_valid,
        "receipt_hash_valid": receipt_hash_valid,
        "valid": check.valid and receipt_hash_valid is not False,
        "bids": [
            {
                "id": bid.id,
                "bidder_alias": alias,
                "amount": bid.amount,
                "created_at": bid.created_at,
                "prev_hash": bid.prev_hash,
                "hash": bid.hash,
                "valid": bid.id not in check.broken_bid_ids,
            }
            for bid, alias in rows
        ],
    }
