import asyncio
import uuid
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.models import Card

BASE_URL = "https://api.scryfall.com"
IMAGE_HOST = "https://cards.scryfall.io/"
HEADERS = {"User-Agent": "BidMagic/0.1", "Accept": "application/json"}
TIMEOUT = httpx.Timeout(10.0)
SEARCH_LIMIT = 20
EXTRA_FIELDS = (
    "set",
    "collector_number",
    "mana_cost",
    "oracle_text",
    "flavor_text",
    "released_at",
)


def service_unavailable() -> AppError:
    return AppError(
        "CARD_SERVICE_UNAVAILABLE",
        "Serviço de cartas indisponível. Tente novamente em instantes.",
        503,
    )


def card_not_found() -> AppError:
    return AppError("CARD_NOT_FOUND", "Carta não encontrada.", 404)


def image_url(data: dict[str, Any]) -> str | None:
    uris = data.get("image_uris")
    if uris is None and data.get("card_faces"):
        uris = data["card_faces"][0].get("image_uris")
    return (uris or {}).get("normal")


def to_search_result(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "scryfall_id": data["id"],
        "name": data["name"],
        "set_name": data["set_name"],
        "rarity": data["rarity"],
        "type_line": data.get("type_line"),
        "image_url": image_url(data),
    }


async def request(url: str, params: dict[str, str] | None = None) -> httpx.Response:
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=TIMEOUT) as client:
            return await client.get(url, params=params)
    except httpx.HTTPError:
        raise service_unavailable() from None


async def search_cards(query: str) -> list[dict[str, Any]]:
    response = await request(
        f"{BASE_URL}/cards/search", {"q": query, "unique": "cards", "order": "name"}
    )
    if response.status_code in (400, 404):
        return []
    if response.status_code != 200:
        raise service_unavailable()
    cards = [card for card in response.json()["data"] if image_url(card)]
    return [to_search_result(card) for card in cards[:SEARCH_LIMIT]]


async def fetch_card(scryfall_id: str) -> dict[str, Any]:
    response = await request(f"{BASE_URL}/cards/{scryfall_id}")
    if response.status_code == 404:
        raise card_not_found()
    if response.status_code != 200:
        raise service_unavailable()
    data = response.json()
    if not image_url(data):
        raise card_not_found()
    return data


def write_atomic(target: Path, content: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(f"{target.name}.{uuid.uuid4().hex}.tmp")
    temp.write_bytes(content)
    temp.replace(target)


async def download_image(url: str, scryfall_id: str) -> str:
    relative_path = f"cards/{scryfall_id}.jpg"
    target = settings.media_dir / relative_path
    if target.exists():
        return relative_path
    if not url.startswith(IMAGE_HOST):
        raise service_unavailable()

    response = await request(url)
    content_type = response.headers.get("content-type", "")
    if response.status_code != 200 or not content_type.startswith("image/"):
        raise service_unavailable()

    await asyncio.to_thread(write_atomic, target, response.content)
    return relative_path


def normalize_scryfall_id(scryfall_id: str) -> str:
    try:
        return str(uuid.UUID(scryfall_id))
    except ValueError:
        raise card_not_found() from None


async def get_or_create_card(session: AsyncSession, scryfall_id: str) -> Card:
    scryfall_id = normalize_scryfall_id(scryfall_id)
    query = select(Card).where(Card.scryfall_id == scryfall_id)

    card = await session.scalar(query)
    if card:
        return card

    data = await fetch_card(scryfall_id)
    image_path = await download_image(image_url(data), scryfall_id)

    await session.execute(
        insert(Card)
        .values(
            scryfall_id=scryfall_id,
            name=data["name"],
            set_name=data["set_name"],
            rarity=data["rarity"],
            artist=data.get("artist"),
            type_line=data.get("type_line"),
            extra={field: data[field] for field in EXTRA_FIELDS if field in data},
            image_path=image_path,
        )
        .on_conflict_do_nothing(index_elements=["scryfall_id"])
    )
    return await session.scalar(query)
