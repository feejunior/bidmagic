from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field, field_validator

LotStatus = Literal["scheduled", "live", "closed", "cancelled"]
LotStatusFilter = Literal["scheduled", "live", "closed"]
Rarity = Literal["common", "uncommon", "rare", "mythic", "special", "bonus"]

MAX_AMOUNT = 1_000_000_000


class LotCreate(BaseModel):
    scryfall_id: str = Field(max_length=64)
    description: str | None = Field(default=None, max_length=1000)
    starting_bid: int = Field(gt=0, le=MAX_AMOUNT)
    min_increment: int = Field(gt=0, le=MAX_AMOUNT)
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class CardOut(BaseModel):
    scryfall_id: str
    name: str
    set_name: str
    rarity: str
    artist: str | None
    type_line: str | None
    image_url: str


class LotSummary(BaseModel):
    id: int
    status: LotStatus
    card: CardOut
    auctioneer_alias: str
    starting_bid: int
    min_increment: int
    current_bid: int | None
    minimum_bid: int
    bid_count: int
    leader_alias: str | None
    starts_at: datetime
    ends_at: datetime


class BidOut(BaseModel):
    bidder_alias: str
    amount: int
    created_at: datetime


class LotDetail(LotSummary):
    description: str | None
    original_ends_at: datetime
    recent_bids: list[BidOut]
    server_now: datetime


class LotList(BaseModel):
    server_now: datetime
    items: list[LotSummary]


class MyLots(BaseModel):
    server_now: datetime
    total_received: int
    lots: list[LotSummary]
