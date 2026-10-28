from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(primary_key=True)
    lot_id: Mapped[int] = mapped_column(ForeignKey("lots.id"), unique=True)
    winner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    final_amount: Mapped[int] = mapped_column(BigInteger)
    public_code: Mapped[str] = mapped_column(String(43), unique=True)
    last_hash: Mapped[str] = mapped_column(String(64))
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
