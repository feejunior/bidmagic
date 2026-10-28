from datetime import UTC, datetime, timedelta

import pytest

from app.core.errors import AppError
from app.models import Lot, User
from app.rules.bidding import (
    calculate_new_end,
    format_brl,
    minimum_bid,
    validate_bid,
)

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)


def make_lot(**overrides) -> Lot:
    fields = {
        "id": 1,
        "status": "active",
        "starting_bid": 10_000,
        "min_increment": 500,
        "current_bid": None,
        "leader_id": None,
        "starts_at": NOW - timedelta(hours=1),
        "ends_at": NOW + timedelta(hours=1),
    }
    return Lot(**{**fields, **overrides})


def make_user(user_id: int = 10, role: str = "bidder") -> User:
    return User(id=user_id, role=role)


def error_code(lot: Lot, user: User, amount: int, available: int = 1_000_000) -> str:
    with pytest.raises(AppError) as error:
        validate_bid(lot, user, amount, available, NOW)
    return error.value.code


def test_minimum_bid_without_bids_is_starting_bid():
    assert minimum_bid(make_lot()) == 10_000


def test_minimum_bid_with_bids_adds_increment():
    assert minimum_bid(make_lot(current_bid=12_000, leader_id=20)) == 12_500


def test_valid_bid_passes():
    validate_bid(make_lot(), make_user(), 10_000, 10_000, NOW)


def test_auctioneer_cannot_bid():
    assert error_code(make_lot(), make_user(role="auctioneer"), 10_000) == (
        "AUCTIONEER_CANNOT_BID"
    )


def test_cancelled_lot_rejects_bid():
    assert error_code(make_lot(status="cancelled"), make_user(), 10_000) == (
        "LOT_CANCELLED"
    )


def test_closed_lot_rejects_bid():
    assert error_code(make_lot(status="closed"), make_user(), 10_000) == "LOT_CLOSED"


def test_scheduled_lot_rejects_bid():
    lot = make_lot(starts_at=NOW + timedelta(minutes=1))
    assert error_code(lot, make_user(), 10_000) == "LOT_NOT_STARTED"


def test_bid_at_exact_end_is_rejected():
    assert error_code(make_lot(ends_at=NOW), make_user(), 10_000) == "LOT_CLOSED"


def test_leader_cannot_outbid_himself():
    lot = make_lot(current_bid=10_000, leader_id=10)
    assert error_code(lot, make_user(10), 20_000) == "ALREADY_WINNING"


def test_bid_below_minimum_is_rejected():
    lot = make_lot(current_bid=10_000, leader_id=20)
    assert error_code(lot, make_user(), 10_499) == "BELOW_MINIMUM"


def test_below_minimum_message_shows_minimum_in_brl():
    lot = make_lot(current_bid=10_000, leader_id=20)
    with pytest.raises(AppError) as error:
        validate_bid(lot, make_user(), 10_000, 1_000_000, NOW)
    assert error.value.message == "Lance mínimo: R$ 105,00"


def test_bid_above_available_balance_is_rejected():
    assert error_code(make_lot(), make_user(), 10_000, available=9_999) == (
        "INSUFFICIENT_FUNDS"
    )


def test_validation_order_role_before_status():
    lot = make_lot(status="cancelled")
    assert error_code(lot, make_user(role="auctioneer"), 1) == "AUCTIONEER_CANNOT_BID"


def test_format_brl():
    assert format_brl(5) == "R$ 0,05"
    assert format_brl(123_456_789) == "R$ 1.234.567,89"


def test_no_extension_far_from_end():
    ends_at = NOW + timedelta(minutes=10)
    assert calculate_new_end(ends_at, NOW, extend_from_end=False) == ends_at


def test_soft_close_extends_two_minutes_from_now():
    ends_at = NOW + timedelta(seconds=30)
    new_end = calculate_new_end(ends_at, NOW, extend_from_end=False)
    assert new_end == NOW + timedelta(minutes=2)


def test_extend_from_end_adds_two_minutes_to_current_end():
    ends_at = NOW + timedelta(seconds=30)
    new_end = calculate_new_end(ends_at, NOW, extend_from_end=True)
    assert new_end == ends_at + timedelta(minutes=2)


def test_window_boundary_at_exactly_two_minutes_extends():
    ends_at = NOW + timedelta(minutes=2)
    new_end = calculate_new_end(ends_at, NOW, extend_from_end=False)
    assert new_end == NOW + timedelta(minutes=2)
