from typing import Any

from fastapi import APIRouter, Request

from app.core.deps import CurrentBidder, SessionDep
from app.core.rate_limit import limiter
from app.schemas.wallet import DepositCreate, WalletOut, WithdrawalCreate
from app.services import wallet as wallet_service

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


@router.get("", response_model=WalletOut)
async def get_wallet(user: CurrentBidder, session: SessionDep) -> dict[str, Any]:
    return await wallet_service.get_wallet(session, user)


@router.post("/deposits", response_model=WalletOut, status_code=201)
@limiter.limit("10/minute")
async def deposit(
    request: Request, data: DepositCreate, user: CurrentBidder, session: SessionDep
) -> dict[str, Any]:
    await wallet_service.deposit(session, user, data.amount)
    return await wallet_service.get_wallet(session, user)


@router.post("/withdrawals", response_model=WalletOut, status_code=201)
@limiter.limit("10/minute")
async def withdraw(
    request: Request, data: WithdrawalCreate, user: CurrentBidder, session: SessionDep
) -> dict[str, Any]:
    await wallet_service.withdraw(session, user, data.amount)
    return await wallet_service.get_wallet(session, user)
