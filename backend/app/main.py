from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session

app = FastAPI(title="BidMagic API")


@app.get("/api/health")
async def health(session: Annotated[AsyncSession, Depends(get_session)]):
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
