from datetime import datetime, timedelta

from app.core.errors import AppError
from app.models import Lot, User

ANTI_SNIPING_WINDOW = timedelta(minutes=2)


def format_brl(cents: int) -> str:
    reais, centavos = divmod(cents, 100)
    return f"R$ {reais:,}".replace(",", ".") + f",{centavos:02d}"


def minimum_bid(lot: Lot) -> int:
    if lot.current_bid is None:
        return lot.starting_bid
    return lot.current_bid + lot.min_increment


def validate_bid(
    lot: Lot, bidder: User, amount: int, available: int, now: datetime
) -> None:
    if bidder.role != "bidder":
        raise AppError("AUCTIONEER_CANNOT_BID", "Leiloeiros não podem dar lances.")
    if lot.status == "cancelled":
        raise AppError("LOT_CANCELLED", "Este lote foi cancelado.")
    if lot.status == "closed":
        raise AppError("LOT_CLOSED", "Este lote já foi encerrado.")
    if now < lot.starts_at:
        raise AppError("LOT_NOT_STARTED", "Este lote ainda não começou.")
    if now >= lot.ends_at:
        raise AppError("LOT_CLOSED", "Este lote já foi encerrado.")
    if lot.leader_id == bidder.id:
        raise AppError("ALREADY_WINNING", "Você já está ganhando este lote.")

    minimum = minimum_bid(lot)
    if amount < minimum:
        raise AppError("BELOW_MINIMUM", f"Lance mínimo: {format_brl(minimum)}")
    if amount > available:
        raise AppError("INSUFFICIENT_FUNDS", "Saldo insuficiente para este lance.")


def calculate_new_end(
    ends_at: datetime, now: datetime, extend_from_end: bool
) -> datetime:
    if ends_at - now > ANTI_SNIPING_WINDOW:
        return ends_at
    base = ends_at if extend_from_end else now
    return base + ANTI_SNIPING_WINDOW
