from fastapi import APIRouter, WebSocket, status

from app.core.db import SessionLocal
from app.core.deps import LotId
from app.core.rooms import rooms
from app.models import Lot

router = APIRouter()


@router.websocket("/ws/lots/{lot_id}")
async def lot_room(websocket: WebSocket, lot_id: LotId) -> None:
    async with SessionLocal() as session:
        lot = await session.get(Lot, lot_id)
    if lot is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if rooms.is_full(lot_id):
        await websocket.close(code=status.WS_1013_TRY_AGAIN_LATER)
        return

    await websocket.accept()
    rooms.join(lot_id, websocket)
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
    finally:
        rooms.leave(lot_id, websocket)
