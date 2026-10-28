import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

MAX_CONNECTIONS_PER_LOT = 500


class LotRooms:
    def __init__(self) -> None:
        self.rooms: dict[int, set[WebSocket]] = defaultdict(set)

    def is_full(self, lot_id: int) -> bool:
        return len(self.rooms[lot_id]) >= MAX_CONNECTIONS_PER_LOT

    def join(self, lot_id: int, websocket: WebSocket) -> None:
        self.rooms[lot_id].add(websocket)

    def leave(self, lot_id: int, websocket: WebSocket) -> None:
        room = self.rooms.get(lot_id)
        if room is None:
            return
        room.discard(websocket)
        if not room:
            del self.rooms[lot_id]

    async def broadcast(self, lot_id: int, message: dict[str, Any]) -> None:
        connections = list(self.rooms.get(lot_id, ()))
        if not connections:
            return
        payload = jsonable_encoder(message)
        results = await asyncio.gather(
            *(connection.send_json(payload) for connection in connections),
            return_exceptions=True,
        )
        for connection, result in zip(connections, results, strict=True):
            if isinstance(result, Exception):
                self.leave(lot_id, connection)


rooms = LotRooms()
