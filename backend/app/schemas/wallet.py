from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

MAX_DEPOSIT = 100_000_000


class DepositCreate(BaseModel):
    amount: int = Field(gt=0, le=MAX_DEPOSIT)


class LedgerEntryOut(BaseModel):
    id: int
    type: Literal["deposit", "purchase", "sale"]
    amount: int
    lot_id: int | None
    card_name: str | None
    created_at: datetime


class WalletOut(BaseModel):
    total: int
    committed: int
    available: int
    entries: list[LedgerEntryOut]
