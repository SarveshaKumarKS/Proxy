"""Lightweight in-memory + file-backed memory store for proxy agents."""
import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime


MEMORY_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(MEMORY_DIR, exist_ok=True)


class ProxyMemory:
    """Persistent memory for a single proxy agent."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.path = os.path.join(MEMORY_DIR, f"{user_id}.json")
        self.data = self._load()

    def _load(self) -> Dict:
        if os.path.exists(self.path):
            with open(self.path) as f:
                return json.load(f)
        return {
            "compromise_history": [],
            "preferred_venues": [],
            "scheduling_habits": [],
            "social_energy_patterns": {},
            "negotiation_personality": {},
            "historical_fairness": {"times_compromised": 0, "times_won": 0},
            "interpersonal": {},  # keyed by other user_id
        }

    def save(self):
        with open(self.path, "w") as f:
            json.dump(self.data, f, indent=2, default=str)

    def record_compromise(self, session_id: str, what: str, for_user: str):
        self.data["compromise_history"].append({
            "session": session_id,
            "what": what,
            "for_user": for_user,
            "at": datetime.utcnow().isoformat(),
        })
        self.data["historical_fairness"]["times_compromised"] += 1
        self.save()

    def record_win(self, session_id: str, what: str):
        self.data["compromise_history"].append({
            "session": session_id,
            "what": f"won: {what}",
            "at": datetime.utcnow().isoformat(),
        })
        self.data["historical_fairness"]["times_won"] += 1
        self.save()

    def add_preferred_venue(self, venue: Dict):
        existing = [v["name"] for v in self.data["preferred_venues"]]
        if venue.get("name") not in existing:
            self.data["preferred_venues"].append(venue)
            self.save()

    def update_interpersonal(self, other_user_id: str, note: str):
        if other_user_id not in self.data["interpersonal"]:
            self.data["interpersonal"][other_user_id] = []
        self.data["interpersonal"][other_user_id].append({
            "note": note,
            "at": datetime.utcnow().isoformat(),
        })
        self.save()

    def get_context_summary(self) -> str:
        h = self.data["historical_fairness"]
        total = h["times_compromised"] + h["times_won"]
        compromise_rate = (h["times_compromised"] / total * 100) if total > 0 else 50

        venues = [v["name"] for v in self.data["preferred_venues"][-3:]]
        interpersonal_notes = []
        for uid, notes in self.data["interpersonal"].items():
            if notes:
                interpersonal_notes.append(notes[-1]["note"])

        lines = [
            f"Historical compromise rate: {compromise_rate:.0f}%",
            f"Times compromised: {h['times_compromised']}, times preference won: {h['times_won']}",
        ]
        if venues:
            lines.append(f"Previously enjoyed venues: {', '.join(venues)}")
        if interpersonal_notes:
            lines.append("Interpersonal history: " + "; ".join(interpersonal_notes[:3]))
        return "\n".join(lines)


class GroupMemory:
    """Shared memory for a group of users."""

    def __init__(self, group_key: str):
        self.group_key = group_key
        self.path = os.path.join(MEMORY_DIR, f"group_{group_key}.json")
        self.data = self._load()

    def _load(self) -> Dict:
        if os.path.exists(self.path):
            with open(self.path) as f:
                return json.load(f)
        return {
            "sessions": [],
            "preferred_meetup_types": {},
            "compatibility_scores": {},
        }

    def save(self):
        with open(self.path, "w") as f:
            json.dump(self.data, f, indent=2, default=str)

    def record_session(self, session: Dict):
        self.data["sessions"].append({**session, "at": datetime.utcnow().isoformat()})
        self.save()

    def get_summary(self) -> str:
        total_sessions = len(self.data["sessions"])
        if not total_sessions:
            return "No previous group sessions."
        last = self.data["sessions"][-1]
        return f"Group has met {total_sessions} time(s). Last session: {last.get('venue', 'unknown')}."


_proxy_memories: Dict[str, ProxyMemory] = {}
_group_memories: Dict[str, GroupMemory] = {}


def get_proxy_memory(user_id: str) -> ProxyMemory:
    if user_id not in _proxy_memories:
        _proxy_memories[user_id] = ProxyMemory(user_id)
    return _proxy_memories[user_id]


def get_group_memory(user_ids: List[str]) -> GroupMemory:
    key = "_".join(sorted(user_ids))
    if key not in _group_memories:
        _group_memories[key] = GroupMemory(key)
    return _group_memories[key]
