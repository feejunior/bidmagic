import hashlib
import hmac
from dataclasses import dataclass
from datetime import UTC, datetime

from app.models import Bid


@dataclass
class ChainCheck:
    valid: bool
    broken_bid_ids: list[int]
    seal_valid: bool


def sign(key: str, message: str) -> str:
    return hmac.new(key.encode(), message.encode(), hashlib.sha256).hexdigest()


def canonical_time(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def genesis_hash(key: str, lot_id: int) -> str:
    return sign(key, f"genesis|{lot_id}")


def bid_hash(
    key: str,
    lot_id: int,
    bidder_id: int,
    amount: int,
    created_at: datetime,
    prev_hash: str,
) -> str:
    message = f"{lot_id}|{bidder_id}|{amount}|{canonical_time(created_at)}|{prev_hash}"
    return sign(key, message)


def lot_seal(key: str, lot_id: int, bid_count: int, last_hash: str) -> str:
    return sign(key, f"{lot_id}|{bid_count}|{last_hash}")


def verify_chain(
    key: str, lot_id: int, bids: list[Bid], seal: str | None
) -> ChainCheck:
    broken_bid_ids = []
    prev_hash = genesis_hash(key, lot_id)

    for bid in bids:
        expected = bid_hash(
            key, lot_id, bid.bidder_id, bid.amount, bid.created_at, bid.prev_hash
        )
        links = hmac.compare_digest(bid.prev_hash, prev_hash)
        matches = hmac.compare_digest(bid.hash, expected)
        if not (links and matches):
            broken_bid_ids.append(bid.id)
        prev_hash = bid.hash

    expected_seal = lot_seal(key, lot_id, len(bids), prev_hash)
    seal_valid = hmac.compare_digest(seal or "", expected_seal)
    return ChainCheck(
        valid=not broken_bid_ids and seal_valid,
        broken_bid_ids=broken_bid_ids,
        seal_valid=seal_valid,
    )
