from typing import Annotated, Any

from fastapi import APIRouter, Query, Request

from app.core.deps import MAX_DB_ID, CurrentAuctioneer, LotId, SessionDep
from app.core.rate_limit import limiter
from app.schemas.lot import (
    MAX_AMOUNT,
    LotCreate,
    LotDetail,
    LotList,
    LotSort,
    LotStatusFilter,
    MyLots,
    Rarity,
)
from app.services import lots as lot_service

router = APIRouter(prefix="/api", tags=["lots"])


@router.get("/lots", response_model=LotList)
async def list_lots(
    session: SessionDep,
    status: Annotated[list[LotStatusFilter] | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    rarity: Annotated[list[Rarity] | None, Query()] = None,
    min_price: Annotated[int | None, Query(ge=0, le=MAX_AMOUNT)] = None,
    max_price: Annotated[int | None, Query(ge=0, le=MAX_AMOUNT)] = None,
    sort: LotSort = "ending",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=MAX_DB_ID)] = 0,
) -> dict[str, Any]:
    query = q.strip() if q else None
    return await lot_service.list_lots(
        session,
        status or [],
        query,
        rarity or [],
        min_price,
        max_price,
        sort,
        limit,
        offset,
    )


@router.get("/lots/{lot_id}", response_model=LotDetail)
async def get_lot(lot_id: LotId, session: SessionDep) -> dict[str, Any]:
    return await lot_service.get_lot_detail(session, lot_id)


@router.post("/lots", response_model=LotDetail, status_code=201)
@limiter.limit("20/minute")
async def create_lot(
    request: Request, data: LotCreate, user: CurrentAuctioneer, session: SessionDep
) -> dict[str, Any]:
    lot_id = await lot_service.create_lot(session, user, data)
    return await lot_service.get_lot_detail(session, lot_id)


@router.post("/lots/{lot_id}/cancel", status_code=204)
async def cancel_lot(
    lot_id: LotId, user: CurrentAuctioneer, session: SessionDep
) -> None:
    await lot_service.cancel_lot(session, user, lot_id)


@router.get("/my-lots", response_model=MyLots)
async def my_lots(user: CurrentAuctioneer, session: SessionDep) -> dict[str, Any]:
    return await lot_service.get_my_lots(session, user)
