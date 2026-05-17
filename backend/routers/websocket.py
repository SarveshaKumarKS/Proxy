"""WebSocket endpoint and connection manager for real-time room updates."""
import json
from typing import Dict, List, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from models.schemas import WebSocketMessage

router = APIRouter(tags=["websocket"])


# ---------------------------------------------------------------------------
# Connection Manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Manages WebSocket connections per room."""

    def __init__(self):
        # room_id -> set of active WebSocket connections
        self._rooms: Dict[str, Set[WebSocket]] = {}

    def _ensure_room(self, room_id: str):
        if room_id not in self._rooms:
            self._rooms[room_id] = set()

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        self._ensure_room(room_id)
        self._rooms[room_id].add(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id in self._rooms:
            self._rooms[room_id].discard(websocket)
            if not self._rooms[room_id]:
                del self._rooms[room_id]

    async def broadcast(self, room_id: str, message: dict):
        """Send a JSON message to all connections in a room."""
        if room_id not in self._rooms:
            return

        dead: List[WebSocket] = []
        payload = json.dumps(message, default=str)

        for ws in list(self._rooms[room_id]):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self._rooms[room_id].discard(ws)

    async def send_personal(self, websocket: WebSocket, message: dict):
        """Send a JSON message to a single WebSocket connection."""
        try:
            await websocket.send_text(json.dumps(message, default=str))
        except Exception:
            pass

    def room_count(self, room_id: str) -> int:
        return len(self._rooms.get(room_id, set()))


# Singleton instance
_manager = ConnectionManager()


def get_connection_manager() -> ConnectionManager:
    return _manager


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    """
    WebSocket endpoint for a room.
    Message types handled: join, update_constraints, veto, chat
    Broadcasts: room_update, negotiation_message, fairness_update, consensus_achieved
    """
    manager = get_connection_manager()
    await manager.connect(room_id, websocket)

    # Send a welcome message on connect
    await manager.send_personal(websocket, {
        "type": "connected",
        "data": {
            "room_id": room_id,
            "message": f"Connected to room {room_id}",
            "connections": manager.room_count(room_id),
        }
    })

    # Notify others of new connection (use distinct type so frontend doesn't treat as full room)
    await manager.broadcast(room_id, {
        "type": "participant_connected",
        "data": {"connections": manager.room_count(room_id)},
    })

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                payload = json.loads(raw)
                msg_type = payload.get("type", "")
                data = payload.get("data", {})
            except json.JSONDecodeError:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "data": {"message": "Invalid JSON"}
                })
                continue

            # --------------- Handle message types ---------------

            if msg_type == "join":
                # User identifies themselves on WS connect
                user_name = data.get("user_name", "Unknown")
                await manager.broadcast(room_id, {
                    "type": "room_update",
                    "data": {
                        "message": f"{user_name} joined the room",
                        "user_name": user_name,
                    }
                })

            elif msg_type == "update_constraints":
                # User updates their constraints via WebSocket
                user_id = data.get("user_id")
                constraint_type = data.get("constraint_type")
                new_value = data.get("new_value")

                if user_id and constraint_type and new_value is not None:
                    # Import room store lazily
                    from routers.rooms import get_room_store
                    from services.fairness import compute_all_metrics

                    store = get_room_store()
                    room = store.get(room_id)
                    if room:
                        user = room.users.get(user_id)
                        if user:
                            ct = constraint_type.lower()
                            if ct == "budget":
                                user.preferences.budget = new_value
                            elif ct == "travel":
                                user.preferences.travel_tolerance = new_value
                            elif ct == "noise":
                                user.preferences.noise_tolerance = new_value

                            room.fairness = compute_all_metrics(room)
                            await manager.broadcast(room_id, {
                                "type": "fairness_update",
                                "data": {"fairness": room.fairness.model_dump()}
                            })

            elif msg_type == "veto":
                # Real-time veto via WebSocket
                user_id = data.get("user_id")
                veto_target = data.get("veto_target", "")
                reason = data.get("reason", "")

                if user_id:
                    from routers.rooms import get_room_store
                    from models.schemas import NegotiationMessage

                    store = get_room_store()
                    room = store.get(room_id)
                    if room:
                        user = room.users.get(user_id)
                        proxy_model = room.proxies.get(user_id)

                        if user:
                            veto_msg = NegotiationMessage(
                                proxy_name=proxy_model.proxy_name if proxy_model else user.name,
                                human_name=user.name,
                                message=f"[VETO] {user.name} vetoed '{veto_target}': {reason}",
                                message_type="conflict",
                            )
                            room.messages.append(veto_msg)

                            await manager.broadcast(room_id, {
                                "type": "negotiation_message",
                                "data": {"message": veto_msg.model_dump(mode="json")}
                            })

                            # Have proxy respond asynchronously
                            if proxy_model:
                                import asyncio
                                from agents.proxy_agent import ProxyAgent
                                from memory.store import get_proxy_memory

                                async def _proxy_respond():
                                    memory = get_proxy_memory(user_id)
                                    agent = ProxyAgent(proxy_model, user, memory)
                                    response = await agent.respond_to_veto(f"{veto_target}: {reason}")
                                    room.messages.append(response)
                                    await manager.broadcast(room_id, {
                                        "type": "negotiation_message",
                                        "data": {"message": response.model_dump(mode="json")}
                                    })

                                asyncio.create_task(_proxy_respond())

            elif msg_type == "chat":
                # Simple chat relay — not AI-powered, just broadcast
                user_name = data.get("user_name", "Unknown")
                message = data.get("message", "")
                if message:
                    await manager.broadcast(room_id, {
                        "type": "chat",
                        "data": {
                            "user_name": user_name,
                            "message": message,
                        }
                    })

            elif msg_type == "ping":
                await manager.send_personal(websocket, {
                    "type": "pong",
                    "data": {}
                })

            else:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "data": {"message": f"Unknown message type: {msg_type}"}
                })

    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
        await manager.broadcast(room_id, {
            "type": "participant_disconnected",
            "data": {"connections": manager.room_count(room_id)},
        })
    except Exception as e:
        manager.disconnect(room_id, websocket)
