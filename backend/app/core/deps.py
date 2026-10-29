from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import decode_access_token
from app.models import User

ACCESS_COOKIE = "access_token"

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_optional_user(
    session: SessionDep,
    access_token: Annotated[str | None, Cookie()] = None,
) -> User | None:
    user_id = decode_access_token(access_token) if access_token else None
    return await session.get(User, user_id) if user_id else None


OptionalUser = Annotated[User | None, Depends(get_optional_user)]


async def get_current_user(user: OptionalUser) -> User:
    if user is None:
        raise AppError("NOT_AUTHENTICATED", "Faça login para continuar.", 401)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_auctioneer(user: CurrentUser) -> User:
    if user.role != "auctioneer":
        raise AppError("FORBIDDEN", "Apenas leiloeiros podem fazer isso.", 403)
    return user


async def get_current_bidder(user: CurrentUser) -> User:
    if user.role != "bidder":
        raise AppError("FORBIDDEN", "Apenas licitantes podem fazer isso.", 403)
    return user


CurrentAuctioneer = Annotated[User, Depends(get_current_auctioneer)]
CurrentBidder = Annotated[User, Depends(get_current_bidder)]
