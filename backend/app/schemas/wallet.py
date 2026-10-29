from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, StrictInt

MAX_DEPOSIT = 10_000_000


class DepositCreate(BaseModel):
    amount: StrictInt = Field(gt=0, le=MAX_DEPOSIT)


class WithdrawalCreate(BaseModel):
    amount: StrictInt = Field(gt=0, le=MAX_DEPOSIT)


class LedgerEntryOut(BaseModel):
    id: int
    type: Literal["deposit", "withdrawal", "purchase", "sale"]
    amount: int
    lot_id: int | None
    card_name: str | None
    created_at: datetime


class WalletOut(BaseModel):
    total: int
    committed: int
    available: int
    entries: list[LedgerEntryOut]
