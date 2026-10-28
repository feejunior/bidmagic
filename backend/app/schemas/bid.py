from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.lot import MAX_AMOUNT, LotSummary


class BidCreate(BaseModel):
    amount: int = Field(gt=0, le=MAX_AMOUNT)


class BidPlaced(BaseModel):
    lot_id: int
    amount: int
    bidder_alias: str
    created_at: datetime
    ends_at: datetime
    bid_count: int
    minimum_bid: int
    server_now: datetime


class MyBid(BaseModel):
    lot: LotSummary
    my_highest_bid: int
    is_leader: bool
    receipt_code: str | None


class MyBids(BaseModel):
    server_now: datetime
    items: list[MyBid]
