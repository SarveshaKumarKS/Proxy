"""FastAPI router for room management endpoints."""
import logging
import traceback
from typing import List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

logger = logging.getLogger(__name__)

from models.schemas import (
    CreateRoomRequest,
    JoinRoomRequest,
    NegotiationMessage,
    RelaxConstraintRequest,
    RoomState,
    VenueProposal,
    VetoRequest,
)
from services.places import search_venues
from services.fairness import compute_all_metrics

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


# ---------------------------------------------------------------------------
# Dependency — injected from main.py
# ---------------------------------------------------------------------------

_room_store: dict = {}


def get_room_store() -> dict:
    return _room_store


def set_room_store(store: dict):
    """Called by main.py to inject the shared store."""
    global _room_store
    _room_store = store


def _ensure_unique_proxy_names(room: RoomState) -> bool:
    """Rename duplicate proxy names in-place. Returns True if anything changed."""
    from agents.proxy_agent import PROXY_NAMES

    used: set[str] = set()
    changed = False

    def rename_proxy(proxy, new_name: str) -> None:
        old_name = (proxy.proxy_name or "").strip()
        proxy.proxy_name = new_name
        if old_name and proxy.personality_summary:
            proxy.personality_summary = proxy.personality_summary.replace(old_name, new_name, 1)

    def align_summary_name(proxy) -> bool:
        prefix = "I'm "
        if not proxy.personality_summary.startswith(prefix):
            return False
        rest = proxy.personality_summary[len(prefix):]
        current_intro = rest.split(",", 1)[0].split(" ", 1)[0]
        if current_intro == proxy.proxy_name:
            return False
        proxy.personality_summary = proxy.personality_summary.replace(
            f"{prefix}{current_intro}",
            f"{prefix}{proxy.proxy_name}",
            1,
        )
        return True

    for proxy in room.proxies.values():
        original = (proxy.proxy_name or "").strip() or "Proxy"
        lowered = original.lower()
        if lowered not in used:
            proxy.proxy_name = original
            used.add(lowered)
            changed = align_summary_name(proxy) or changed
            continue

        for candidate in PROXY_NAMES:
            if candidate.lower() not in used:
                rename_proxy(proxy, candidate)
                used.add(candidate.lower())
                changed = True
                break
        else:
            suffix = 2
            while f"{original}{suffix}".lower() in used:
                suffix += 1
            rename_proxy(proxy, f"{original}{suffix}")
            used.add(proxy.proxy_name.lower())
            changed = True

    return changed


# ---------------------------------------------------------------------------
# Helper to get or 404
# ---------------------------------------------------------------------------

def _get_room(room_id: str, store: dict) -> RoomState:
    room = store.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{room_id}' not found")
    if _ensure_unique_proxy_names(room):
        store[room_id] = room
    return room


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=dict, status_code=201)
async def create_room(
    body: CreateRoomRequest,
    store: dict = Depends(get_room_store),
):
    """Create a new room and return its ID."""
    room = RoomState(
        name=body.resolved_name,
        template=body.template,
        location=body.location,
        time_range=body.resolved_time_range,
    )
    store[room.id] = room
    return {"room_id": room.id, "status": room.status}


@router.get("/{room_id}", response_model=RoomState)
async def get_room(
    room_id: str,
    store: dict = Depends(get_room_store),
):
    """Get the current state of a room."""
    return _get_room(room_id, store)


@router.post("/{room_id}/join", response_model=dict)
async def join_room(
    room_id: str,
    body: JoinRoomRequest,
    store: dict = Depends(get_room_store),
):
    """Join a room with a user profile."""
    room = _get_room(room_id, store)

    user = body.user_profile
    user.room_id = room_id
    room.users[user.id] = user
    store[room_id] = room

    # Broadcast updated room to all connected clients so participant count updates live
    from routers.websocket import get_connection_manager
    manager = get_connection_manager()
    await manager.broadcast(room_id, {
        "type": "room_state",
        "data": room.model_dump(mode="json"),
    })

    return {
        "user_id": user.id,
        "room_id": room_id,
        "user_count": len(room.users),
    }


@router.post("/{room_id}/start", response_model=dict)
async def start_negotiation(
    room_id: str,
    background_tasks: BackgroundTasks,
    store: dict = Depends(get_room_store),
):
    """
    Start the negotiation for a room.
    The orchestrator runs in the background; progress is streamed via WebSocket.
    """
    room = _get_room(room_id, store)

    if room.status not in ("waiting", "onboarding"):
        raise HTTPException(
            status_code=400,
            detail=f"Room is already in status '{room.status}'"
        )

    if len(room.users) < 1:
        raise HTTPException(status_code=400, detail="At least 1 user must join before starting")

    # Import here to avoid circular dependency
    try:
        from agents.orchestrator import run_negotiation
        from routers.websocket import get_connection_manager
    except Exception as exc:
        logger.error("Negotiation startup failed for room %s: %s\n%s", room_id, exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Negotiation startup failed: {exc}")

    room.status = "negotiating"
    store[room_id] = room

    async def _run():
        manager = get_connection_manager()

        async def broadcast_fn(event_type: str, data: dict):
            await manager.broadcast(room_id, {"type": event_type, "data": data})

        try:
            logger.info("Negotiation starting for room %s with %d users", room_id, len(room.users))
            updated_room = await run_negotiation(room, broadcast_fn)
            store[room_id] = updated_room
            logger.info("Negotiation complete for room %s, status=%s", room_id, updated_room.status)
        except Exception as exc:
            logger.error("Negotiation crashed for room %s: %s\n%s", room_id, exc, traceback.format_exc())
            await manager.broadcast(room_id, {
                "type": "negotiation_message",
                "data": {
                    "message": {
                        "proxy_name": "System",
                        "human_name": "System",
                        "message": f"Negotiation error: {exc}",
                        "message_type": "info",
                    }
                },
            })

    background_tasks.add_task(_run)

    return {"status": "negotiation_started", "room_id": room_id}


@router.post("/{room_id}/relax", response_model=dict)
async def relax_constraint(
    room_id: str,
    body: RelaxConstraintRequest,
    store: dict = Depends(get_room_store),
):
    """Relax a constraint for a user (e.g. expand budget or travel tolerance)."""
    room = _get_room(room_id, store)

    user = room.users.get(body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found in room")

    constraint = body.constraint_type.lower()
    value = body.new_value

    if constraint == "budget":
        user.preferences.budget = value
    elif constraint == "travel":
        user.preferences.travel_tolerance = value
    elif constraint == "noise":
        user.preferences.noise_tolerance = value
    elif constraint == "time":
        # time relaxation: update availability
        user.preferences.availability_start = value
    else:
        raise HTTPException(status_code=400, detail=f"Unknown constraint type: {constraint}")

    # Recompute fairness after constraint change
    room.fairness = compute_all_metrics(room)

    # Notify via WebSocket
    from routers.websocket import get_connection_manager
    manager = get_connection_manager()
    await manager.broadcast(room_id, {
        "type": "room_update",
        "data": {
            "fairness": room.fairness.model_dump(),
            "message": f"{user.name} relaxed their {constraint} constraint to '{value}'",
        }
    })

    return {
        "user_id": body.user_id,
        "constraint": constraint,
        "new_value": value,
        "fairness": room.fairness.model_dump(),
    }


@router.post("/{room_id}/veto", response_model=dict)
async def veto(
    room_id: str,
    body: VetoRequest,
    store: dict = Depends(get_room_store),
):
    """
    Allow a user to veto something in the negotiation.
    The relevant proxy agent responds to the veto.
    """
    room = _get_room(room_id, store)

    user = room.users.get(body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found in room")

    proxy_model = room.proxies.get(body.user_id)

    from routers.websocket import get_connection_manager
    manager = get_connection_manager()

    # Record the veto as a negotiation message
    veto_msg = NegotiationMessage(
        proxy_name=proxy_model.proxy_name if proxy_model else user.name,
        human_name=user.name,
        message=f'{user.name} jumped in: "{body.reason}"',
        message_type="conflict",
    )
    room.messages.append(veto_msg)

    await manager.broadcast(room_id, {
        "type": "negotiation_message",
        "data": {"message": veto_msg.model_dump(mode="json")}
    })

    # Have the proxy respond to the veto
    if proxy_model:
        from agents.proxy_agent import ProxyAgent
        from memory.store import get_proxy_memory

        memory = get_proxy_memory(body.user_id)
        agent = ProxyAgent(proxy_model, user, memory)
        response_msg = await agent.respond_to_veto(
            f"{body.veto_target}: {body.reason}"
        )
        room.messages.append(response_msg)

        await manager.broadcast(room_id, {
            "type": "negotiation_message",
            "data": {"message": response_msg.model_dump(mode="json")}
        })

    return {
        "veto_recorded": True,
        "user_id": body.user_id,
        "veto_target": body.veto_target,
    }


@router.get("/{room_id}/venues", response_model=List[VenueProposal])
async def get_venues(
    room_id: str,
    store: dict = Depends(get_room_store),
):
    """Get venue proposals for a room. Fetches from Places API if not yet populated."""
    room = _get_room(room_id, store)

    has_stale_mock_venues = (
        bool(room.location)
        and bool(room.venues)
        and all(v.proposed_by == "system" for v in room.venues)
        and all(room.location.lower() not in v.address.lower() for v in room.venues)
    )

    if not room.venues or has_stale_mock_venues:
        query_map = {
            "dinner_night": "restaurant dinner",
            "chill_hangout": "cafe bar hangout",
            "startup_brainstorm": "coworking space",
            "study_session": "library cafe",
            "remote_coworking": "coworking",
            "custom_meetup": "meeting venue",
        }
        query = query_map.get(room.template.value, "venue")
        location = room.location or "San Francisco"
        room.venues = await search_venues(query, location, room.template.value)
        store[room_id] = room

    return room.venues
