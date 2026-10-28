from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.core.deps import SessionDep
from app.core.errors import AppError, app_error_handler, validation_error_handler
from app.core.rate_limit import limiter, rate_limit_handler
from app.routers import auth

app = FastAPI(title="BidMagic API")

app.state.limiter = limiter
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

app.include_router(auth.router)


@app.get("/api/health")
async def health(session: SessionDep):
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
