import asyncio
import sys
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import LedgerEntry, Lot, User
from app.routers.auth import new_alias
from app.rules.audit import genesis_hash, lot_seal
from app.rules.bidding import validate_bid
from app.services.bids import append_bid
from app.services.lots import utcnow
from app.services.scryfall import get_or_create_card, search_cards
from app.services.wallet import get_available

PASSWORD = "bidmagic123"
MIN_BIDDER_BALANCE = 300_000

USERS = [
    ("Leiloeiro Demo", "leiloeiro@bidmagic.dev", "auctioneer", 0),
    ("Ana Licitante", "ana@bidmagic.dev", "bidder", 500_000),
    ("Bruno Licitante", "bruno@bidmagic.dev", "bidder", 500_000),
]

LOTS = [
    {
        "card": "Black Lotus",
        "description": "Carta icônica, estado excelente.",
        "starting_bid": 50_000,
        "min_increment": 5_000,
        "starts_in": timedelta(hours=-1),
        "duration": timedelta(hours=3),
        "bids": [("ana", 50_000), ("bruno", 60_000), ("ana", 70_000)],
    },
    {
        "card": "Lightning Bolt",
        "description": "Clássico do formato vermelho.",
        "starting_bid": 1_000,
        "min_increment": 200,
        "starts_in": timedelta(minutes=-30),
        "duration": timedelta(minutes=50),
        "bids": [("bruno", 1_000), ("ana", 1_400)],
    },
    {
        "card": "Sol Ring",
        "description": None,
        "starting_bid": 3_000,
        "min_increment": 500,
        "starts_in": timedelta(minutes=-10),
        "duration": timedelta(days=1),
        "bids": [],
    },
    {
        "card": "Serra Angel",
        "description": "Começa em breve.",
        "starting_bid": 800,
        "min_increment": 100,
        "starts_in": timedelta(hours=1),
        "duration": timedelta(hours=2),
        "bids": [],
    },
    {
        "card": "Counterspell",
        "description": "Leilão já encerrado.",
        "starting_bid": 1_500,
        "min_increment": 250,
        "starts_in": timedelta(hours=-3),
        "duration": timedelta(hours=2),
        "bids": [("ana", 1_500), ("bruno", 2_000)],
    },
]


async def find_scryfall_id(name: str) -> str:
    results = await search_cards(f'!"{name}"')
    exact = [card for card in results if card["name"] == name]
    if not exact:
        raise RuntimeError(f"Card not found on Scryfall: {name}")
    return exact[0]["scryfall_id"]


async def create_users(session: AsyncSession) -> dict[str, User]:
    users = {}
    for name, email, role, deposit in USERS:
        user = User(
            name=name,
            email=email,
            password_hash=hash_password(PASSWORD),
            role=role,
            alias=new_alias(role),
        )
        session.add(user)
        await session.flush()
        if deposit:
            session.add(LedgerEntry(user_id=user.id, type="deposit", amount=deposit))
        users[email.split("@")[0]] = user
    return users


async def create_lot(
    session: AsyncSession, auctioneer: User, users: dict[str, User], spec: dict
) -> None:
    card = await get_or_create_card(session, await find_scryfall_id(spec["card"]))
    now = utcnow()
    starts_at = now + spec["starts_in"]
    ends_at = starts_at + spec["duration"]

    lot = Lot(
        card_id=card.id,
        auctioneer_id=auctioneer.id,
        description=spec["description"],
        starting_bid=spec["starting_bid"],
        min_increment=spec["min_increment"],
        starts_at=starts_at,
        original_ends_at=ends_at,
        ends_at=ends_at,
        status="active",
        bid_count=0,
    )
    session.add(lot)
    await session.flush()
    key = settings.audit_hmac_key
    lot.last_hash = genesis_hash(key, lot.id)
    lot.seal = lot_seal(key, lot.id, 0, lot.last_hash)

    bids = spec["bids"]
    for index, (bidder_key, amount) in enumerate(bids, start=1):
        bidder = users[bidder_key]
        bid_time = starts_at + (min(ends_at, now) - starts_at) * index / (len(bids) + 1)
        await session.flush()
        validate_bid(
            lot, bidder, amount, await get_available(session, bidder.id), bid_time
        )
        session.add(append_bid(lot, bidder, amount, bid_time))


async def load_users(session: AsyncSession) -> dict[str, User]:
    emails = [email for _, email, _, _ in USERS]
    users = await session.scalars(select(User).where(User.email.in_(emails)))
    loaded = {user.email.split("@")[0]: user for user in users}
    if len(loaded) != len(USERS):
        raise RuntimeError("Demo users are incomplete, reset the database instead.")
    return loaded


async def top_up_bidders(session: AsyncSession, users: dict[str, User]) -> None:
    for user in users.values():
        if user.role != "bidder":
            continue
        available = await get_available(session, user.id)
        if available < MIN_BIDDER_BALANCE:
            session.add(
                LedgerEntry(
                    user_id=user.id,
                    type="deposit",
                    amount=MIN_BIDDER_BALANCE - available,
                )
            )
    await session.flush()


async def seed(refresh_lots: bool) -> None:
    async with SessionLocal() as session:
        exists = await session.scalar(select(User.id).where(User.email == USERS[0][1]))
        if exists and not refresh_lots:
            print("Seed already applied. Use --refresh-lots to add new demo lots.")
            return

        if exists:
            users = await load_users(session)
            await top_up_bidders(session, users)
        else:
            users = await create_users(session)

        for spec in LOTS:
            await create_lot(session, users["leiloeiro"], users, spec)
        await session.commit()

    print("New demo lots created." if exists else "Seed applied.")
    for name, email, role, _ in USERS:
        print(f"  {role:<10} {email:<26} senha: {PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed(refresh_lots="--refresh-lots" in sys.argv))
