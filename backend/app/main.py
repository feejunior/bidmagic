import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.core.config import settings
from app.core.deps import SessionDep
from app.core.errors import AppError, app_error_handler, validation_error_handler
from app.core.rate_limit import limiter, rate_limit_handler
from app.routers import audit, auth, bids, cards, lots, wallet
from app.services.settlement import settlement_loop


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(settlement_loop())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="BidMagic API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

app.include_router(auth.router)
app.include_router(cards.router)
app.include_router(lots.router)
app.include_router(bids.router)
app.include_router(wallet.router)
app.include_router(audit.router)

settings.media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")


@app.get("/api/health")
async def health(session: SessionDep):
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
