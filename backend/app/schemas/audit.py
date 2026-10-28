from datetime import datetime

from pydantic import BaseModel

from app.schemas.lot import CardOut, LotStatus


class ReceiptOut(BaseModel):
    public_code: str
    lot_id: int
    card: CardOut
    auctioneer_alias: str
    winner_alias: str
    final_amount: int
    last_hash: str
    issued_at: datetime


class AuditBid(BaseModel):
    id: int
    bidder_alias: str
    amount: int
    created_at: datetime
    prev_hash: str
    hash: str
    valid: bool


class AuditOut(BaseModel):
    lot_id: int
    card_name: str
    status: LotStatus
    bid_count: int
    genesis_hash: str
    last_hash: str | None
    seal: str | None
    seal_valid: bool
    receipt_hash_valid: bool | None
    valid: bool
    bids: list[AuditBid]
