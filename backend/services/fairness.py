"""Fairness scoring engine for Proxy negotiation platform."""
import math
import statistics
from typing import Dict, List, Optional

from models.schemas import FairnessMetrics, NegotiationMessage, ProxyAgent, RoomState, UserProfile


def _haversine_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Compute great-circle distance in km between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _km_to_travel_minutes(km: float) -> float:
    """Rough estimate: 30 km/h average urban travel speed."""
    return (km / 30.0) * 60.0


def compute_travel_fairness(users: Dict, proposed_lat: Optional[float] = None, proposed_lng: Optional[float] = None) -> float:
    """
    Given user locations and an optional proposed venue lat/lng, compute a fairness
    score (0–100) based on how equitable travel times are across users.
    100 = perfectly equal travel; lower = more unfair.
    """
    travel_times: List[float] = []

    # Collect user locations
    locations: List[tuple] = []
    for user_id, user in users.items():
        if isinstance(user, dict):
            loc = user.get("preferences", {}).get("location")
        else:
            loc = user.preferences.location if hasattr(user, "preferences") else None

        if loc and isinstance(loc, dict):
            lat = loc.get("lat") or loc.get("latitude")
            lng = loc.get("lng") or loc.get("longitude")
            if lat is not None and lng is not None:
                locations.append((float(lat), float(lng)))

    if not locations:
        return 75.0  # default neutral score

    if proposed_lat is not None and proposed_lng is not None:
        # Compute each user's travel time to the proposed venue
        for lat, lng in locations:
            dist = _haversine_distance_km(lat, lng, proposed_lat, proposed_lng)
            travel_times.append(_km_to_travel_minutes(dist))
    else:
        # Use geographic centroid as proxy venue
        centroid_lat = sum(l[0] for l in locations) / len(locations)
        centroid_lng = sum(l[1] for l in locations) / len(locations)
        for lat, lng in locations:
            dist = _haversine_distance_km(lat, lng, centroid_lat, centroid_lng)
            travel_times.append(_km_to_travel_minutes(dist))

    if len(travel_times) < 2:
        return 90.0

    mean_time = statistics.mean(travel_times)
    std_time = statistics.stdev(travel_times)

    # Normalise: 0 std => perfect fairness (100); large std => low score
    # Cap std effect at ~60 minutes difference
    fairness = max(0.0, 100.0 - (std_time / max(mean_time, 1.0)) * 50.0)
    return round(min(100.0, fairness), 2)


def compute_compromise_balance(room_state: RoomState) -> float:
    """
    Analyse the negotiation messages to see how balanced the compromise is.
    Score 0–100: 100 = all proxies contributed equally to compromise.
    """
    if not room_state.messages:
        return 50.0

    compromise_counts: Dict[str, int] = {}
    for msg in room_state.messages:
        if msg.message_type in ("compromise", "proposal"):
            compromise_counts[msg.proxy_name] = compromise_counts.get(msg.proxy_name, 0) + 1

    if not compromise_counts:
        return 50.0

    counts = list(compromise_counts.values())
    if len(counts) < 2:
        return 80.0

    mean_count = statistics.mean(counts)
    std_count = statistics.stdev(counts)
    cv = std_count / max(mean_count, 1.0)  # coefficient of variation

    # CV of 0 = perfectly balanced (100); high CV = unbalanced
    balance = max(0.0, 100.0 - cv * 80.0)
    return round(min(100.0, balance), 2)


def compute_budget_harmony(users: Dict) -> float:
    """
    Compute harmony (0–100) across user budget preferences.
    100 = everyone has same budget tier; lower = more divergent.
    """
    budget_map = {"low": 1, "medium": 2, "high": 3, "luxury": 4}

    scores: List[int] = []
    for user_id, user in users.items():
        if isinstance(user, dict):
            budget = user.get("preferences", {}).get("budget", "medium")
        else:
            budget = user.preferences.budget if hasattr(user, "preferences") else "medium"
        scores.append(budget_map.get(budget, 2))

    if not scores:
        return 75.0
    if len(scores) < 2:
        return 90.0

    std = statistics.stdev(scores)
    # Max possible std across 4 levels ≈ 1.5; map to 0–100
    harmony = max(0.0, 100.0 - (std / 1.5) * 80.0)
    return round(min(100.0, harmony), 2)


def compute_social_balance(users: Dict) -> float:
    """
    Compute social balance score (0–100) based on introvert/extrovert mix.
    100 = well-balanced group; lower = everyone is at an extreme.
    """
    social_scores: List[float] = []
    for user_id, user in users.items():
        if isinstance(user, dict):
            slider = user.get("personality", {}).get("social_intimate", 0.5)
        else:
            slider = user.personality.social_intimate if hasattr(user, "personality") else 0.5
        social_scores.append(float(slider))

    if not social_scores:
        return 75.0

    mean_score = statistics.mean(social_scores)
    # How close is mean to center (0.5)?
    centrality = 1.0 - abs(mean_score - 0.5) * 2.0

    if len(social_scores) >= 2:
        std = statistics.stdev(social_scores)
        # Moderate diversity is good; extreme is bad
        diversity_bonus = 1.0 - abs(std - 0.25) * 2.0
        balance = (centrality * 0.6 + max(0.0, diversity_bonus) * 0.4) * 100.0
    else:
        balance = centrality * 100.0

    return round(max(0.0, min(100.0, balance)), 2)


def compute_all_metrics(room_state: RoomState) -> FairnessMetrics:
    """Compute all fairness metrics and return a FairnessMetrics object."""
    users = room_state.users

    # Determine proposed venue coordinates if available
    proposed_lat, proposed_lng = None, None
    if room_state.venues:
        best = room_state.venues[0]
        proposed_lat, proposed_lng = best.lat, best.lng

    travel = compute_travel_fairness(users, proposed_lat, proposed_lng)
    compromise = compute_compromise_balance(room_state)
    budget = compute_budget_harmony(users)
    social = compute_social_balance(users)
    alignment = compute_group_alignment(room_state.messages, list(room_state.proxies.values()))

    return FairnessMetrics(
        group_alignment=alignment,
        travel_fairness=travel,
        budget_harmony=budget,
        compromise_balance=compromise,
        social_balance=social,
    )


def compute_group_alignment(messages: List[NegotiationMessage], proxies: List) -> float:
    """
    Estimate how close proxies are to agreeing (0–100).
    Uses simple heuristics: ratio of consensus/compromise messages to conflict messages.
    """
    if not messages:
        return 0.0

    total = len(messages)
    consensus_msgs = sum(1 for m in messages if m.message_type in ("consensus", "compromise"))
    conflict_msgs = sum(1 for m in messages if m.message_type == "conflict")
    proposal_msgs = sum(1 for m in messages if m.message_type == "proposal")

    # Base alignment grows as we get more compromise/consensus messages
    if total == 0:
        return 0.0

    # Weight: consensus=high, compromise=medium, proposal=low, conflict=negative
    weighted_score = (
        sum(1.5 for m in messages if m.message_type == "consensus") +
        sum(1.0 for m in messages if m.message_type == "compromise") +
        sum(0.3 for m in messages if m.message_type == "proposal") +
        sum(-0.5 for m in messages if m.message_type == "conflict")
    )

    # Normalize to a maximum possible score
    max_possible = total * 1.5
    alignment = max(0.0, min(100.0, (weighted_score / max(max_possible, 1)) * 100.0))

    # If there's a resolver message, boost alignment significantly
    resolver_msgs = sum(1 for m in messages if m.message_type == "resolver")
    if resolver_msgs > 0:
        alignment = min(100.0, alignment + 20.0)

    return round(alignment, 2)
