"""FastAPI application entry point for Proxy backend."""
import os
import json
from typing import Dict
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_anthropic_api_key, load_environment
from models.schemas import RoomState
from routers import rooms as rooms_router_module
from routers import websocket as websocket_router_module

load_environment()

# ---------------------------------------------------------------------------
# Persistent room store — survives hot reloads
# ---------------------------------------------------------------------------

_STORE_PATH = Path(__file__).parent / ".room_store.json"


def _load_store() -> Dict[str, RoomState]:
    if _STORE_PATH.exists():
        try:
            raw = json.loads(_STORE_PATH.read_text())
            return {k: RoomState.model_validate(v) for k, v in raw.items()}
        except Exception:
            pass
    return {}


def _save_store(store: Dict[str, RoomState]):
    try:
        _STORE_PATH.write_text(
            json.dumps({k: v.model_dump(mode="json") for k, v in store.items()}, indent=2)
        )
    except Exception:
        pass


class PersistentRoomStore(dict):
    """dict subclass that auto-saves on every write."""

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        _save_store(self)

    def __delitem__(self, key):
        super().__delitem__(key)
        _save_store(self)


_room_store: Dict[str, RoomState] = PersistentRoomStore(_load_store())


def get_room_store() -> Dict[str, RoomState]:
    return _room_store


# Inject the store into the rooms router
rooms_router_module.set_room_store(_room_store)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Proxy — AI Meetup Coordination",
    description="Backend for Proxy, an AI-powered multiplayer meetup coordination platform.",
    version="1.0.0",
)

# CORS — allow frontend dev server
_default_cors_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://34.68.124.246:3000",
    "http://34.68.124.246:3001",
]

_cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", ",".join(_default_cors_origins)).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(rooms_router_module.router)
app.include_router(websocket_router_module.router)

# ---------------------------------------------------------------------------
# Health & root
# ---------------------------------------------------------------------------

@app.get("/", tags=["health"])
async def root():
    return {
        "service": "Proxy Backend",
        "status": "running",
        "version": "1.0.0",
        "rooms": len(_room_store),
    }


@app.get("/health", tags=["health"])
async def health():
    return {
        "status": "ok",
        "rooms_active": len(_room_store),
        "claude_configured": bool(get_anthropic_api_key()),
    }


# ---------------------------------------------------------------------------
# Run directly with uvicorn for development
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "true").lower() == "true"

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )
