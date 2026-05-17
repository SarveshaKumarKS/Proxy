"""
LangGraph-powered 7-step negotiation orchestrator.

Orchestrates the full negotiation lifecycle:
1. collect_preferences
2. generate_proxies
3. parallel_proposals
4. detect_conflicts
5. negotiate_rounds
6. human_checkpoint
7. generate_consensus
"""
import asyncio
import json
from typing import Any, Callable, Dict, List, Optional, TypedDict

from langgraph.graph import StateGraph, END

from models.schemas import (
    NegotiationMessage,
    ProxyAgent as ProxyAgentModel,
    RoomState,
    VenueProposal,
)
from memory.store import get_proxy_memory
from agents.proxy_agent import ProxyAgent
from agents.resolver_agent import ResolverAgent
from services.places import search_venues
from services.weather import get_weather_context
from services.fairness import compute_all_metrics


# ---------------------------------------------------------------------------
# LangGraph state definition
# ---------------------------------------------------------------------------

class NegotiationState(TypedDict):
    room: RoomState
    venues: List[VenueProposal]
    conflicts: List[str]
    proposals: List[NegotiationMessage]
    broadcast_fn: Any  # Callable — LangGraph doesn't restrict types in TypedDict
    human_veto_pending: bool
    round: int
    error: Optional[str]


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------

async def _broadcast(broadcast_fn: Callable, event_type: str, data: dict):
    """Safely invoke the broadcast callback."""
    try:
        if asyncio.iscoroutinefunction(broadcast_fn):
            await broadcast_fn(event_type, data)
        else:
            broadcast_fn(event_type, data)
    except Exception:
        pass


async def collect_preferences(state: NegotiationState) -> NegotiationState:
    """Node 1: Gather preferences and fetch weather/venue context."""
    room: RoomState = state["room"]
    broadcast_fn = state["broadcast_fn"]

    await _broadcast(broadcast_fn, "negotiation_message", {
        "message": {
            "proxy_name": "System",
            "human_name": "System",
            "message": "Gathering preferences and checking local context...",
            "message_type": "proposal",
        }
    })

    # Fetch weather context
    if room.location:
        try:
            weather = await get_weather_context(room.location)
            room.weather_context = weather
        except Exception:
            room.weather_context = "Weather data unavailable"
    else:
        room.weather_context = "Weather data unavailable"

    room.status = "negotiating"
    room.negotiation_round = 1

    await _broadcast(broadcast_fn, "room_state", room.model_dump(mode="json"))

    return {**state, "room": room}


async def generate_proxies(state: NegotiationState) -> NegotiationState:
    """Node 2: Generate proxy profiles for all users in parallel."""
    room: RoomState = state["room"]
    broadcast_fn = state["broadcast_fn"]

    await _broadcast(broadcast_fn, "negotiation_message", {
        "message": {
            "proxy_name": "System",
            "human_name": "System",
            "message": f"Awakening {len(room.users)} proxy agents...",
            "message_type": "proposal",
        }
    })

    async def create_proxy_for_user(user_id: str, user):
        memory = get_proxy_memory(user_id)
        # Create a temporary ProxyAgentModel for the ProxyAgent constructor
        temp_proxy = ProxyAgentModel(
            proxy_name="Pending",
            human_name=user.name,
            user_id=user_id,
            negotiation_style="Balanced",
            personality_summary="Generating...",
        )
        agent = ProxyAgent(temp_proxy, user, memory)
        profile = await agent.generate_proxy_profile()

        proxy_model = ProxyAgentModel(
            proxy_name=profile["proxy_name"],
            human_name=user.name,
            user_id=user_id,
            negotiation_style=profile["negotiation_style"],
            personality_summary=profile["personality_summary"],
            color=profile.get("color", "#60a5fa"),
        )
        return user_id, proxy_model

    tasks = [create_proxy_for_user(uid, user) for uid, user in room.users.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, Exception):
            continue
        user_id, proxy_model = result
        room.proxies[user_id] = proxy_model

        await _broadcast(broadcast_fn, "negotiation_message", {
            "message": {
                "proxy_name": proxy_model.proxy_name,
                "human_name": proxy_model.human_name,
                "message": f"I'm {proxy_model.proxy_name} — {proxy_model.personality_summary}",
                "message_type": "proposal",
                "color": proxy_model.color,
            }
        })

    # Broadcast full room state so frontend picks up new proxies immediately
    await _broadcast(broadcast_fn, "room_state", room.model_dump(mode="json"))

    return {**state, "room": room}


async def parallel_proposals(state: NegotiationState) -> NegotiationState:
    """Node 3: Each proxy makes an initial proposal simultaneously."""
    room: RoomState = state["room"]
    broadcast_fn = state["broadcast_fn"]

    # Search for venues
    query_map = {
        "dinner_night": "restaurant dinner",
        "chill_hangout": "cafe bar hangout",
        "startup_brainstorm": "coworking space cafe",
        "study_session": "library quiet cafe",
        "remote_coworking": "coworking space",
        "custom_meetup": "meeting venue",
    }
    query = query_map.get(room.template.value, "venue")
    location = room.location or "San Francisco"

    try:
        venues = await search_venues(query, location, room.template.value)
        room.venues = venues
    except Exception:
        room.venues = []

    context = (
        f"We're planning a {room.template.value.replace('_', ' ')} meetup.\n"
        f"Location: {location}\n"
        f"Time: {room.time_range or 'flexible'}\n"
        f"Weather: {room.weather_context or 'unknown'}\n"
        f"Available venues:\n"
    )
    for v in room.venues[:3]:
        context += f"  - {v.name} ({v.type}): {v.address}\n"

    proxy_names = [p.proxy_name for p in room.proxies.values()]
    context += f"\nOther agents in this negotiation: {', '.join(proxy_names)}"

    async def make_proposal_for(user_id: str, proxy_model: ProxyAgentModel):
        user = room.users.get(user_id)
        if not user:
            return None
        memory = get_proxy_memory(user_id)
        agent = ProxyAgent(proxy_model, user, memory)
        msg = await agent.make_proposal(context, round=1)
        return msg

    tasks = [make_proposal_for(uid, proxy) for uid, proxy in room.proxies.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    proposals = []
    for result in results:
        if isinstance(result, Exception) or result is None:
            continue
        proposals.append(result)
        room.messages.append(result)

        await _broadcast(broadcast_fn, "negotiation_message", {
            "message": result.model_dump(mode="json")
        })

    # Update fairness metrics
    room.fairness = compute_all_metrics(room)
    await _broadcast(broadcast_fn, "fairness_update", {
        "fairness": room.fairness.model_dump()
    })

    return {**state, "room": room, "proposals": proposals, "round": 1}


async def detect_conflicts(state: NegotiationState) -> NegotiationState:
    """Node 4: Resolver analyzes proposals and identifies conflicts."""
    room: RoomState = state["room"]
    broadcast_fn = state["broadcast_fn"]

    resolver = ResolverAgent()
    conflicts = await resolver.detect_conflicts(room.messages)

    if conflicts:
        conflict_msg = NegotiationMessage(
            proxy_name="Resolver",
            human_name="System",
            message=f"I've identified {len(conflicts)} point(s) to resolve: {'; '.join(conflicts[:3])}",
            message_type="conflict",
        )
        room.messages.append(conflict_msg)
        await _broadcast(broadcast_fn, "negotiation_message", {
            "message": conflict_msg.model_dump(mode="json")
        })

    return {**state, "room": room, "conflicts": conflicts}


async def negotiate_rounds(state: NegotiationState) -> NegotiationState:
    """Node 5: Proxies engage in 2 rounds of compromise negotiation."""
    room: RoomState = state["room"]
    broadcast_fn = state["broadcast_fn"]
    conflicts = state["conflicts"]

    other_proposals = [m.message for m in room.messages if m.message_type == "proposal"]

    for round_num in range(2, 4):  # rounds 2 and 3
        room.negotiation_round = round_num

        await _broadcast(broadcast_fn, "negotiation_message", {
            "message": {
                "proxy_name": "System",
                "human_name": "System",
                "message": f"Entering compromise round {round_num}...",
                "message_type": "proposal",
            }
        })

        async def compromise_for(user_id: str, proxy_model: ProxyAgentModel):
            user = room.users.get(user_id)
            if not user:
                return None
            memory = get_proxy_memory(user_id)
            agent = ProxyAgent(proxy_model, user, memory)
            msg = await agent.negotiate_compromise(conflicts, other_proposals)
            return msg

        tasks = [compromise_for(uid, proxy) for uid, proxy in room.proxies.items()]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception) or result is None:
                continue
            room.messages.append(result)
            other_proposals.append(result.message)  # update for next round context

            await _broadcast(broadcast_fn, "negotiation_message", {
                "message": result.model_dump(mode="json")
            })

        # Resolver synthesis after each round
        resolver = ResolverAgent()
        resolver_proposal = await resolver.generate_compromise_proposal(room, room.venues)
        room.messages.append(resolver_proposal)

        await _broadcast(broadcast_fn, "negotiation_message", {
            "message": resolver_proposal.model_dump(mode="json")
        })

        # Update fairness
        room.fairness = compute_all_metrics(room)
        await _broadcast(broadcast_fn, "fairness_update", {
            "fairness": room.fairness.model_dump()
        })

        # Small pause between rounds for UX effect (non-blocking)
        await asyncio.sleep(0.5)

    return {**state, "room": room}


async def human_checkpoint(state: NegotiationState) -> NegotiationState:
    """Node 6: Emit a checkpoint event, then continue (human intervention is event-driven)."""
    room: RoomState = state["room"]
    broadcast_fn = state["broadcast_fn"]

    fairness_summary = ""
    try:
        resolver = ResolverAgent()
        fairness_summary = await resolver.compute_fairness_summary(room)
    except Exception:
        fairness_summary = "Fairness analysis complete."

    await _broadcast(broadcast_fn, "negotiation_message", {
        "message": {
            "proxy_name": "Resolver",
            "human_name": "System",
            "message": fairness_summary,
            "message_type": "resolver",
        }
    })

    await _broadcast(broadcast_fn, "human_checkpoint", {
        "message": "Human review opportunity — vetoes and constraint relaxations can be submitted now.",
        "fairness": room.fairness.model_dump(),
        "venues": [v.model_dump() for v in room.venues],
    })

    # In async flow, we continue immediately; real veto handling happens via HTTP endpoints
    return {**state, "room": room, "human_veto_pending": False}


async def generate_consensus(state: NegotiationState) -> NegotiationState:
    """Node 7: Resolver generates the final ConsensusResult."""
    room: RoomState = state["room"]
    broadcast_fn = state["broadcast_fn"]

    await _broadcast(broadcast_fn, "negotiation_message", {
        "message": {
            "proxy_name": "Resolver",
            "human_name": "System",
            "message": "Synthesizing final consensus from all proposals and constraints...",
            "message_type": "resolver",
        }
    })

    resolver = ResolverAgent()
    consensus = await resolver.generate_final_consensus(room, room.venues)
    room.consensus = consensus
    room.status = "consensus"

    # Final fairness update
    room.fairness = compute_all_metrics(room)

    await _broadcast(broadcast_fn, "consensus_achieved", {
        "consensus": consensus.model_dump(mode="json"),
        "fairness": room.fairness.model_dump(),
    })

    await _broadcast(broadcast_fn, "room_update", {
        "status": room.status,
        "consensus": consensus.model_dump(mode="json"),
    })

    return {**state, "room": room}


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

def _build_graph() -> StateGraph:
    graph = StateGraph(NegotiationState)

    graph.add_node("collect_preferences", collect_preferences)
    graph.add_node("generate_proxies", generate_proxies)
    graph.add_node("parallel_proposals", parallel_proposals)
    graph.add_node("detect_conflicts", detect_conflicts)
    graph.add_node("negotiate_rounds", negotiate_rounds)
    graph.add_node("human_checkpoint", human_checkpoint)
    graph.add_node("generate_consensus", generate_consensus)

    graph.set_entry_point("collect_preferences")
    graph.add_edge("collect_preferences", "generate_proxies")
    graph.add_edge("generate_proxies", "parallel_proposals")
    graph.add_edge("parallel_proposals", "detect_conflicts")
    graph.add_edge("detect_conflicts", "negotiate_rounds")
    graph.add_edge("negotiate_rounds", "human_checkpoint")
    graph.add_edge("human_checkpoint", "generate_consensus")
    graph.add_edge("generate_consensus", END)

    return graph.compile()


_compiled_graph = None


def get_compiled_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = _build_graph()
    return _compiled_graph


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def run_negotiation(room: RoomState, broadcast_fn: Callable) -> RoomState:
    """
    Run the full 7-step negotiation pipeline for a room.
    Streams events via broadcast_fn as each node executes.
    Returns the updated RoomState with consensus.
    """
    initial_state: NegotiationState = {
        "room": room,
        "venues": [],
        "conflicts": [],
        "proposals": [],
        "broadcast_fn": broadcast_fn,
        "human_veto_pending": False,
        "round": 0,
        "error": None,
    }

    graph = get_compiled_graph()

    try:
        final_state = await graph.ainvoke(initial_state)
        return final_state["room"]
    except Exception as e:
        # Broadcast error and return room in best-known state
        await _broadcast(broadcast_fn, "negotiation_error", {
            "error": str(e),
            "message": "Negotiation encountered an error — partial results available.",
        })
        room.status = "consensus"  # allow UI to proceed
        return room
