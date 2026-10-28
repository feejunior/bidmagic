from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request

from app.core.deps import get_current_auctioneer
from app.core.rate_limit import limiter
from app.schemas.card import CardSearchResult
from app.services.scryfall import search_cards

router = APIRouter(
    prefix="/api/cards",
    tags=["cards"],
    dependencies=[Depends(get_current_auctioneer)],
)


@router.get("/search", response_model=list[CardSearchResult])
@limiter.limit("30/minute")
async def search(
    request: Request, q: Annotated[str, Query(min_length=2, max_length=100)]
) -> list[dict[str, Any]]:
    return await search_cards(q.strip())
