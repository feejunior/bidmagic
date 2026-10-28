from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Lot(Base):
    __tablename__ = "lots"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'cancelled', 'closed')", name="status"),
        CheckConstraint("starting_bid > 0", name="starting_bid_positive"),
        CheckConstraint("min_increment > 0", name="min_increment_positive"),
        CheckConstraint("ends_at > starts_at", name="ends_after_start"),
        Index("ix_lots_status_ends_at", "status", "ends_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id"))
    auctioneer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    description: Mapped[str | None] = mapped_column(Text)

    starting_bid: Mapped[int] = mapped_column(BigInteger)
    min_increment: Mapped[int] = mapped_column(BigInteger)

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    original_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    status: Mapped[str] = mapped_column(String(20), default="active")

    current_bid: Mapped[int | None] = mapped_column(BigInteger)
    leader_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)

    bid_count: Mapped[int] = mapped_column(default=0)
    last_hash: Mapped[str | None] = mapped_column(String(64))
    seal: Mapped[str | None] = mapped_column(String(64))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
