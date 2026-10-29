import secrets

from fastapi import APIRouter, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.deps import ACCESS_COOKIE, OptionalUser, SessionDep
from app.core.errors import AppError
from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

ALIAS_PREFIX = {"auctioneer": "Leiloeiro", "bidder": "Licitante"}


def set_access_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=create_access_token(user_id),
        max_age=settings.jwt_expire_hours * 3600,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def new_alias(role: str) -> str:
    return f"{ALIAS_PREFIX[role]} #{secrets.token_hex(3).upper()}"


@router.post("/register", response_model=UserOut, status_code=201)
@limiter.limit("10/minute")
async def register(
    request: Request, data: RegisterRequest, response: Response, session: SessionDep
) -> User:
    existing = await session.scalar(select(User.id).where(User.email == data.email))
    if existing:
        raise AppError("EMAIL_ALREADY_REGISTERED", "Este e-mail já está cadastrado.")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        alias=new_alias(data.role),
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise AppError(
            "EMAIL_ALREADY_REGISTERED", "Este e-mail já está cadastrado."
        ) from None

    set_access_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
@limiter.limit("5/minute")
async def login(
    request: Request, data: LoginRequest, response: Response, session: SessionDep
) -> User:
    user = await session.scalar(select(User).where(User.email == data.email))
    password_ok = verify_password(data.password, user.password_hash if user else None)
    if user is None or not password_ok:
        raise AppError("INVALID_CREDENTIALS", "E-mail ou senha inválidos.", 401)

    set_access_cookie(response, user.id)
    return user


@router.post("/logout", status_code=204)
async def logout(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/", secure=True, httponly=True)


@router.get("/me", response_model=UserOut | None)
async def me(user: OptionalUser) -> User | None:
    return user
