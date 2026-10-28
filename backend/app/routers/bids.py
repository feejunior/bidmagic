from typing import Any

from fastapi import APIRouter, Request

from app.core.deps import CurrentBidder, CurrentUser, SessionDep
from app.core.rate_limit import limiter
from app.schemas.bid import BidCreate, BidPlaced, MyBids
from app.services import bids as bid_service

router = APIRouter(prefix="/api", tags=["bids"])


@router.post("/lots/{lot_id}/bids", response_model=BidPlaced, status_code=201)
@limiter.limit("30/minute")
async def place_bid(
    request: Request,
    lot_id: int,
    data: BidCreate,
    user: CurrentUser,
    session: SessionDep,
) -> dict[str, Any]:
    return await bid_service.place_bid(session, user, lot_id, data.amount)


@router.get("/my-bids", response_model=MyBids)
async def my_bids(user: CurrentBidder, session: SessionDep) -> dict[str, Any]:
    return await bid_service.get_my_bids(session, user)
