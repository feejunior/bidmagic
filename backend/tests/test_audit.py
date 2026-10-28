from datetime import UTC, datetime, timedelta

from app.models import Bid
from app.rules.audit import (
    bid_hash,
    canonical_time,
    genesis_hash,
    lot_seal,
    verify_chain,
)

KEY = "test-key"
LOT_ID = 7
START = datetime(2026, 10, 28, 12, 0, 0, 123456, tzinfo=UTC)


def build_chain(amounts: list[int]) -> tuple[list[Bid], str]:
    bids = []
    prev_hash = genesis_hash(KEY, LOT_ID)
    for index, amount in enumerate(amounts, start=1):
        created_at = START + timedelta(seconds=index)
        bidder_id = 100 + index % 2
        current = bid_hash(KEY, LOT_ID, bidder_id, amount, created_at, prev_hash)
        bids.append(
            Bid(
                id=index,
                lot_id=LOT_ID,
                bidder_id=bidder_id,
                amount=amount,
                created_at=created_at,
                prev_hash=prev_hash,
                hash=current,
            )
        )
        prev_hash = current
    return bids, lot_seal(KEY, LOT_ID, len(bids), prev_hash)


def test_canonical_time_is_utc_with_microseconds():
    local = START.astimezone(datetime.now().astimezone().tzinfo)
    assert canonical_time(local) == "2026-10-28T12:00:00.123456Z"


def test_genesis_depends_on_lot():
    assert genesis_hash(KEY, 1) != genesis_hash(KEY, 2)


def test_hash_depends_on_key():
    assert genesis_hash("a", LOT_ID) != genesis_hash("b", LOT_ID)


def test_intact_chain_is_valid():
    bids, seal = build_chain([1000, 1100, 1200])
    result = verify_chain(KEY, LOT_ID, bids, seal)
    assert result.valid
    assert result.broken_bid_ids == []
    assert result.seal_valid


def test_empty_lot_is_valid():
    seal = lot_seal(KEY, LOT_ID, 0, genesis_hash(KEY, LOT_ID))
    assert verify_chain(KEY, LOT_ID, [], seal).valid


def test_changed_amount_is_detected():
    bids, seal = build_chain([1000, 1100, 1200])
    bids[1].amount = 5000
    result = verify_chain(KEY, LOT_ID, bids, seal)
    assert not result.valid
    assert result.broken_bid_ids == [2]


def test_removed_middle_bid_is_detected():
    bids, seal = build_chain([1000, 1100, 1200])
    del bids[1]
    result = verify_chain(KEY, LOT_ID, bids, seal)
    assert not result.valid
    assert result.broken_bid_ids == [3]


def test_removed_last_bid_is_detected_by_seal():
    bids, seal = build_chain([1000, 1100, 1200])
    bids.pop()
    result = verify_chain(KEY, LOT_ID, bids, seal)
    assert not result.valid
    assert result.broken_bid_ids == []
    assert not result.seal_valid


def test_bid_moved_to_another_lot_is_detected():
    bids, _ = build_chain([1000])
    other_seal = lot_seal(KEY, 8, 1, bids[0].hash)
    result = verify_chain(KEY, 8, bids, other_seal)
    assert result.broken_bid_ids == [1]


def test_missing_seal_is_invalid():
    bids, _ = build_chain([1000])
    assert not verify_chain(KEY, LOT_ID, bids, None).seal_valid
