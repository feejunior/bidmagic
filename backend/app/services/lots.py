from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import ColumnElement, Row, Select, and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.core.errors import AppError
from app.models import Bid, Card, LedgerEntry, Lot, User
from app.rules.audit import genesis_hash, lot_seal
from app.rules.bidding import minimum_bid
from app.schemas.lot import LotCreate
from app.services.scryfall import get_or_create_card

MIN_DURATION = timedelta(minutes=5)
MAX_DURATION = timedelta(days=30)
START_TOLERANCE = timedelta(minutes=1)
RECENT_BIDS_LIMIT = 20

Auctioneer = aliased(User)
Leader = aliased(User)


def utcnow() -> datetime:
    return datetime.now(UTC)


def lot_not_found() -> AppError:
    return AppError("LOT_NOT_FOUND", "Lote não encontrado.", 404)


def lot_status(lot: Lot, now: datetime) -> str:
    if lot.status != "active":
        return lot.status
    if now < lot.starts_at:
        return "scheduled"
    if now < lot.ends_at:
        return "live"
    return "closed"


def validate_schedule(starts_at: datetime, ends_at: datetime, now: datetime) -> None:
    if starts_at < now - START_TOLERANCE:
        raise AppError("START_IN_PAST", "O início do lote não pode estar no passado.")
    if not MIN_DURATION <= ends_at - starts_at <= MAX_DURATION:
        raise AppError(
            "INVALID_DURATION", "A duração do lote deve ser entre 5 minutos e 30 dias."
        )


def status_filter(status: str, now: datetime) -> ColumnElement[bool]:
    active = Lot.status == "active"
    if status == "scheduled":
        return and_(active, Lot.starts_at > now)
    if status == "live":
        return and_(active, Lot.starts_at <= now, Lot.ends_at > now)
    return or_(Lot.status == "closed", and_(active, Lot.ends_at <= now))


def lot_query() -> Select:
    return (
        select(Lot, Card, Auctioneer.alias, Leader.alias)
        .join(Card, Card.id == Lot.card_id)
        .join(Auctioneer, Auctioneer.id == Lot.auctioneer_id)
        .outerjoin(Leader, Leader.id == Lot.leader_id)
    )


def to_summary(row: Row, now: datetime) -> dict[str, Any]:
    lot, card, auctioneer_alias, leader_alias = row
    return {
        "id": lot.id,
        "status": lot_status(lot, now),
        "card": {
            "scryfall_id": card.scryfall_id,
            "name": card.name,
            "set_name": card.set_name,
            "rarity": card.rarity,
            "artist": card.artist,
            "type_line": card.type_line,
            "image_url": f"/media/{card.image_path}",
        },
        "auctioneer_alias": auctioneer_alias,
        "starting_bid": lot.starting_bid,
        "min_increment": lot.min_increment,
        "current_bid": lot.current_bid,
        "minimum_bid": minimum_bid(lot),
        "bid_count": lot.bid_count,
        "leader_alias": leader_alias,
        "starts_at": lot.starts_at,
        "ends_at": lot.ends_at,
    }


def current_price() -> ColumnElement[int]:
    return func.coalesce(Lot.current_bid, Lot.starting_bid)


def apply_filters(
    query: Select,
    q: str | None,
    rarities: list[str],
    min_price: int | None,
    max_price: int | None,
) -> Select:
    query = query.where(Lot.status != "cancelled")
    if q:
        query = query.where(
            or_(
                Card.name.icontains(q, autoescape=True),
                Card.set_name.icontains(q, autoescape=True),
            )
        )
    if rarities:
        query = query.where(Card.rarity.in_(rarities))
    if min_price is not None:
        query = query.where(current_price() >= min_price)
    if max_price is not None:
        query = query.where(current_price() <= max_price)
    return query


async def list_lots(
    session: AsyncSession,
    statuses: list[str],
    q: str | None,
    rarities: list[str],
    min_price: int | None,
    max_price: int | None,
    sort: str,
    limit: int,
    offset: int,
) -> dict[str, Any]:
    now = utcnow()
    query = apply_filters(lot_query(), q, rarities, min_price, max_price)
    if statuses:
        query = query.where(or_(*(status_filter(status, now) for status in statuses)))

    if sort == "highest_bid":
        query = query.order_by(current_price().desc(), Lot.id.desc())
    elif sort == "newest":
        query = query.order_by(Lot.created_at.desc(), Lot.id.desc())
    else:
        rank = case(
            (status_filter("closed", now), 2),
            (status_filter("scheduled", now), 1),
            else_=0,
        )
        open_ends_at = case((rank == 2, None), else_=Lot.ends_at)
        query = query.order_by(
            rank, open_ends_at.asc().nulls_last(), Lot.ends_at.desc(), Lot.id.desc()
        )

    rows = (await session.execute(query.limit(limit).offset(offset))).all()

    counts_query = apply_filters(
        select(
            func.count().filter(status_filter("live", now)),
            func.count().filter(status_filter("scheduled", now)),
            func.count().filter(status_filter("closed", now)),
        )
        .select_from(Lot)
        .join(Card, Card.id == Lot.card_id),
        q,
        rarities,
        min_price,
        max_price,
    )
    live, scheduled, closed = (await session.execute(counts_query)).one()

    price_ceiling = await session.scalar(
        select(func.coalesce(func.max(current_price()), 0)).where(
            Lot.status != "cancelled"
        )
    )

    return {
        "server_now": now,
        "items": [to_summary(row, now) for row in rows],
        "counts": {"live": live, "scheduled": scheduled, "closed": closed},
        "price_ceiling": price_ceiling,
    }


async def get_lot_detail(session: AsyncSession, lot_id: int) -> dict[str, Any]:
    row = (await session.execute(lot_query().where(Lot.id == lot_id))).first()
    if row is None:
        raise lot_not_found()

    bids = await session.execute(
        select(Bid.amount, Bid.created_at, User.alias)
        .join(User, User.id == Bid.bidder_id)
        .where(Bid.lot_id == lot_id)
        .order_by(Bid.id.desc())
        .limit(RECENT_BIDS_LIMIT)
    )

    best_amount = func.max(Bid.amount)
    ranking = await session.execute(
        select(User.alias, best_amount)
        .join(User, User.id == Bid.bidder_id)
        .where(Bid.lot_id == lot_id)
        .group_by(User.alias)
        .order_by(best_amount.desc())
    )

    now = utcnow()
    lot = row[0]
    return {
        **to_summary(row, now),
        "description": lot.description,
        "original_ends_at": lot.original_ends_at,
        "recent_bids": [
            {"bidder_alias": alias, "amount": amount, "created_at": created_at}
            for amount, created_at, alias in bids
        ],
        "ranking": [
            {"bidder_alias": alias, "best_amount": amount} for alias, amount in ranking
        ],
        "server_now": now,
    }


async def create_lot(session: AsyncSession, user: User, data: LotCreate) -> int:
    now = utcnow()
    starts_at = (data.starts_at or now).astimezone(UTC)
    ends_at = starts_at + timedelta(minutes=data.duration_minutes)
    validate_schedule(starts_at, ends_at, now)

    card = await get_or_create_card(session, data.scryfall_id)
    lot = Lot(
        card_id=card.id,
        auctioneer_id=user.id,
        description=data.description,
        starting_bid=data.starting_bid,
        min_increment=data.min_increment,
        starts_at=starts_at,
        original_ends_at=ends_at,
        ends_at=ends_at,
        status="active",
        bid_count=0,
    )
    session.add(lot)
    await session.flush()

    lot.last_hash = genesis_hash(settings.audit_hmac_key, lot.id)
    lot.seal = lot_seal(settings.audit_hmac_key, lot.id, 0, lot.last_hash)
    await session.commit()
    return lot.id


async def cancel_lot(session: AsyncSession, user: User, lot_id: int) -> None:
    lot = await session.scalar(select(Lot).where(Lot.id == lot_id).with_for_update())
    if lot is None:
        raise lot_not_found()
    if lot.auctioneer_id != user.id:
        raise AppError("FORBIDDEN", "Este lote não pertence a você.", 403)

    now = utcnow()
    status = lot_status(lot, now)
    if status == "cancelled":
        raise AppError("LOT_CANCELLED", "Este lote já foi cancelado.")
    if status == "closed":
        raise AppError("LOT_CLOSED", "Este lote já foi encerrado.")
    if lot.bid_count > 0:
        raise AppError(
            "LOT_HAS_BIDS", "Não é possível cancelar um lote que já recebeu lances."
        )

    lot.status = "cancelled"
    lot.cancelled_at = now
    await session.commit()


async def get_my_lots(session: AsyncSession, user: User) -> dict[str, Any]:
    now = utcnow()
    rows = await session.execute(
        lot_query()
        .where(Lot.auctioneer_id == user.id)
        .order_by(Lot.created_at.desc(), Lot.id.desc())
    )
    total_received = await session.scalar(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
            LedgerEntry.user_id == user.id, LedgerEntry.type == "sale"
        )
    )
    return {
        "server_now": now,
        "total_received": total_received,
        "lots": [to_summary(row, now) for row in rows],
    }
