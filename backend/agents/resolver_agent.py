"""Central resolver agent — synthesizes conflicts and drives toward consensus."""
import os
import json
from typing import List
import anthropic
from dotenv import load_dotenv

from models.schemas import (
    ConsensusResult,
    NegotiationMessage,
    RoomState,
    VenueProposal,
)
from services.fairness import compute_all_metrics

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


def _format_messages(messages: List[NegotiationMessage]) -> str:
    """Format negotiation messages for Claude context."""
    if not messages:
        return "No messages yet."
    lines = []
    for m in messages[-20:]:  # limit context
        lines.append(f"[{m.proxy_name} ({m.human_name}), type={m.message_type}]: {m.message}")
    return "\n".join(lines)


def _format_venues(venues: List[VenueProposal]) -> str:
    """Format venue proposals for Claude context."""
    if not venues:
        return "No venues proposed yet."
    lines = []
    for v in venues:
        stars = f"{v.rating}★" if v.rating else "unrated"
        price = "$" * (v.price_level or 1) if v.price_level is not None else "$$"
        lines.append(f"- {v.name} ({v.type}): {v.address} | {stars} | {price} | proposed by: {v.proposed_by}")
    return "\n".join(lines)


def _format_users(room: RoomState) -> str:
    """Format user summary for Claude context."""
    lines = []
    for uid, user in room.users.items():
        proxy = room.proxies.get(uid)
        proxy_name = proxy.proxy_name if proxy else "unknown"
        prefs = user.preferences
        lines.append(
            f"- {user.name} (proxy: {proxy_name}): budget={prefs.budget}, "
            f"noise={prefs.noise_tolerance}, travel={prefs.travel_tolerance}, "
            f"food={prefs.food_preferences}"
        )
    return "\n".join(lines) if lines else "No users."


class ResolverAgent:
    """Central AI resolver that analyzes conflicts and generates consensus proposals."""

    def __init__(self):
        self._client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

    async def _call_claude(self, system: str, user_msg: str, max_tokens: int = 1024) -> str:
        """Call Claude claude-sonnet-4-6 async. Returns fallback string on error."""
        if not self._client:
            return "Resolver analysis unavailable — API key not configured."

        try:
            response = await self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": user_msg}],
                system=system,
            )
            return response.content[0].text.strip()
        except Exception as e:
            return f"Resolver encountered an issue: {str(e)}"

    async def detect_conflicts(self, messages: List[NegotiationMessage]) -> List[str]:
        """
        Analyze negotiation messages and return a list of conflict descriptions.
        """
        if not messages:
            return []

        system = (
            "You are a neutral conflict detection system for a group meetup negotiation. "
            "Analyze the negotiation messages and identify concrete conflicts or disagreements. "
            "Return ONLY a JSON array of strings, each describing one conflict. "
            "Keep each conflict description to one sentence. Example: [\"Budget conflict: Nova prefers budget-friendly while Atlas wants upscale dining\"]"
        )

        messages_text = _format_messages(messages)
        user_msg = (
            f"Analyze these negotiation messages for conflicts:\n\n{messages_text}\n\n"
            "Return a JSON array of conflict strings. If no conflicts, return []."
        )

        raw = await self._call_claude(system, user_msg, max_tokens=512)

        try:
            clean = raw.strip()
            if clean.startswith("```"):
                lines = clean.split("\n")
                clean = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            result = json.loads(clean)
            if isinstance(result, list):
                return [str(c) for c in result]
        except Exception:
            pass

        # Fallback: parse line by line
        conflicts = []
        for line in raw.split("\n"):
            line = line.strip().lstrip("-•*").strip()
            if line and len(line) > 10:
                conflicts.append(line)
        return conflicts[:5]

    async def compute_fairness_summary(self, room: RoomState) -> str:
        """
        Return a human-readable fairness analysis of the current negotiation state.
        """
        metrics = compute_all_metrics(room)
        users_text = _format_users(room)
        messages_text = _format_messages(room.messages)

        system = (
            "You are a fairness analyst for a group meetup coordination AI. "
            "Given the fairness metrics and negotiation context, write a concise 2-3 sentence "
            "human-readable summary of how fair the current negotiation state is. "
            "Be empathetic, specific, and actionable."
        )

        user_msg = (
            f"Fairness Metrics:\n"
            f"- Group alignment: {metrics.group_alignment:.0f}/100\n"
            f"- Travel fairness: {metrics.travel_fairness:.0f}/100\n"
            f"- Budget harmony: {metrics.budget_harmony:.0f}/100\n"
            f"- Compromise balance: {metrics.compromise_balance:.0f}/100\n"
            f"- Social balance: {metrics.social_balance:.0f}/100\n\n"
            f"Users:\n{users_text}\n\n"
            f"Recent messages:\n{messages_text}\n\n"
            "Write a brief fairness summary."
        )

        return await self._call_claude(system, user_msg, max_tokens=256)

    async def generate_compromise_proposal(
        self, room: RoomState, venues: List[VenueProposal]
    ) -> NegotiationMessage:
        """
        Synthesize a compromise proposal from the resolver's perspective,
        considering all user constraints and venue options.
        """
        users_text = _format_users(room)
        messages_text = _format_messages(room.messages)
        venues_text = _format_venues(venues)

        system = (
            "You are Resolver, a neutral AI mediator in a group meetup negotiation platform called Proxy. "
            "You analyze all parties' positions and propose a fair compromise. "
            "Speak in first person as 'Resolver'. Be authoritative but empathetic. "
            "Reference specific proxy agents by name. Keep your proposal to 3-4 sentences."
        )

        user_msg = (
            f"You need to propose a compromise for this group meetup negotiation.\n\n"
            f"Group members:\n{users_text}\n\n"
            f"Available venues:\n{venues_text}\n\n"
            f"Negotiation so far:\n{messages_text}\n\n"
            f"Weather context: {room.weather_context or 'Not available'}\n\n"
            "Propose a specific compromise — name a venue, suggest a time, and explain how it balances everyone's needs."
        )

        message_text = await self._call_claude(system, user_msg, max_tokens=400)

        return NegotiationMessage(
            proxy_name="Resolver",
            human_name="System",
            message=message_text,
            message_type="resolver",
        )

    async def generate_final_consensus(
        self, room: RoomState, venues: List[VenueProposal]
    ) -> ConsensusResult:
        """
        Generate the final ConsensusResult with venue, time, format, fairness badges,
        and contribution summary.
        """
        metrics = compute_all_metrics(room)
        users_text = _format_users(room)
        messages_text = _format_messages(room.messages)
        venues_text = _format_venues(venues)
        proxy_names = [p.proxy_name for p in room.proxies.values()]

        system = (
            "You are Resolver, the consensus engine for a group meetup platform called Proxy. "
            "Generate a final consensus result as JSON. "
            "Return ONLY valid JSON with this exact structure:\n"
            "{\n"
            "  \"venue_name\": string (name of chosen venue from the list, or best option),\n"
            "  \"time\": string (suggested meeting time, e.g. '7:30 PM this Friday'),\n"
            "  \"format\": string ('in-person', 'hybrid', or 'online'),\n"
            "  \"backup_plan\": string (alternative if primary falls through),\n"
            "  \"fairness_score\": string ('Excellent', 'Good', 'Fair', or 'Needs Work'),\n"
            "  \"limiting_factors\": array of {\"factor\": string, \"description\": string},\n"
            "  \"contribution_summary\": array of {\"proxy\": string, \"contribution\": string},\n"
            "  \"badges\": array of {\"proxy\": string, \"badge\": string, \"reason\": string}\n"
            "}\n"
            "No markdown, no extra text, only JSON."
        )

        alignment = metrics.group_alignment
        overall_fairness = (
            metrics.travel_fairness + metrics.budget_harmony +
            metrics.compromise_balance + metrics.social_balance
        ) / 4.0

        user_msg = (
            f"Generate the final consensus for this group meetup negotiation.\n\n"
            f"Group members:\n{users_text}\n\n"
            f"Available venues:\n{venues_text}\n\n"
            f"Negotiation transcript:\n{messages_text}\n\n"
            f"Proxy agents: {', '.join(proxy_names)}\n"
            f"Weather context: {room.weather_context or 'Not available'}\n"
            f"Room template: {room.template.value}\n"
            f"Overall fairness score: {overall_fairness:.0f}/100\n\n"
            "Choose the best venue, suggest a time, assign badges to proxies who negotiated well, "
            "and summarize each proxy's contribution. Return valid JSON only."
        )

        raw = await self._call_claude(system, user_msg, max_tokens=1024)

        # Parse and construct ConsensusResult
        try:
            clean = raw.strip()
            if clean.startswith("```"):
                lines = clean.split("\n")
                clean = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            data = json.loads(clean)

            # Find or create the chosen venue
            chosen_venue = None
            venue_name = data.get("venue_name", "")
            for v in venues:
                if venue_name.lower() in v.name.lower() or v.name.lower() in venue_name.lower():
                    chosen_venue = v
                    break
            if not chosen_venue and venues:
                chosen_venue = venues[0]

            alignment_score = min(100.0, max(0.0, alignment + (overall_fairness - 50.0) * 0.3))

            fairness_label = data.get("fairness_score", "Good")
            if overall_fairness >= 80:
                fairness_label = "Excellent"
            elif overall_fairness >= 60:
                fairness_label = "Good"
            elif overall_fairness >= 40:
                fairness_label = "Fair"
            else:
                fairness_label = "Needs Work"

            return ConsensusResult(
                achieved=True,
                alignment_score=round(alignment_score, 1),
                venue=chosen_venue,
                time=data.get("time", room.time_range or "Evening, 7:00 PM"),
                format=data.get("format", "in-person"),
                backup_plan=data.get("backup_plan"),
                fairness_score=fairness_label,
                limiting_factors=data.get("limiting_factors", []),
                contribution_summary=data.get("contribution_summary", []),
                badges_awarded=data.get("badges", []),
            )

        except Exception:
            # Fallback consensus
            chosen_venue = venues[0] if venues else None
            proxy_list = list(room.proxies.values())

            contributions = [
                {"proxy": p.proxy_name, "contribution": f"Advocated for {room.users[p.user_id].name}'s preferences"}
                for p in proxy_list if p.user_id in room.users
            ]

            badges = []
            if proxy_list:
                badges.append({
                    "proxy": proxy_list[0].proxy_name,
                    "badge": "Most Collaborative",
                    "reason": "Led the group toward consensus",
                })

            alignment_score = min(100.0, metrics.group_alignment + 10.0)

            return ConsensusResult(
                achieved=True,
                alignment_score=round(alignment_score, 1),
                venue=chosen_venue,
                time=room.time_range or "Evening, 7:00 PM",
                format="in-person",
                backup_plan="Video call as fallback",
                fairness_score="Good",
                limiting_factors=[
                    {"factor": "Budget range", "description": "Group has varied budget preferences"},
                ],
                contribution_summary=contributions,
                badges_awarded=badges,
            )
