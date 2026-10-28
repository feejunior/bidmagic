from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    scryfall_id: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    set_name: Mapped[str] = mapped_column(String(200))
    rarity: Mapped[str] = mapped_column(String(20), index=True)
    artist: Mapped[str | None] = mapped_column(String(200))
    type_line: Mapped[str | None] = mapped_column(String(200))
    extra: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    image_path: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
