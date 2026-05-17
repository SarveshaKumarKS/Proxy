"""Individual proxy agent powered by Claude — the heart of Proxy negotiation."""
import os
import random
from typing import List
import anthropic
from dotenv import load_dotenv

from models.schemas import NegotiationMessage, ProxyAgent as ProxyAgentModel, UserProfile
from memory.store import ProxyMemory

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

PROXY_NAMES = [
    "Nova", "Atlas", "Echo", "Cipher", "Lyra", "Orion", "Nexus", "Vega",
    "Zephyr", "Axiom", "Solace", "Quasar", "Ember", "Titan", "Iris", "Flux",
]

PROXY_COLORS = [
    "#60a5fa",  # neon blue
    "#a78bfa",  # purple
    "#34d399",  # green
    "#fbbf24",  # amber
    "#f472b6",  # pink
    "#38bdf8",  # sky blue
    "#fb923c",  # orange
    "#818cf8",  # indigo
]


def _personality_description(user: UserProfile) -> str:
    """Convert personality sliders into a text description."""
    p = user.personality
    traits = []

    if p.diplomatic_assertive < 0.35:
        traits.append("diplomatically careful, avoids confrontation")
    elif p.diplomatic_assertive > 0.65:
        traits.append("assertive and direct, speaks their mind")
    else:
        traits.append("balanced between diplomacy and assertiveness")

    if p.practical_adventurous < 0.35:
        traits.append("practical and reliable")
    elif p.practical_adventurous > 0.65:
        traits.append("adventurous and open to new experiences")

    if p.flexible_stubborn < 0.35:
        traits.append("flexible and easy-going about plans")
    elif p.flexible_stubborn > 0.65:
        traits.append("has strong preferences and sticks to them")

    if p.concise_expressive < 0.35:
        traits.append("concise and to-the-point")
    elif p.concise_expressive > 0.65:
        traits.append("expressive and loves to elaborate")

    if p.analytical_emotional < 0.35:
        traits.append("highly analytical and data-driven")
    elif p.analytical_emotional > 0.65:
        traits.append("emotionally-driven and values feelings over logic")

    if p.cheap_luxury < 0.35:
        traits.append("budget-conscious")
    elif p.cheap_luxury > 0.65:
        traits.append("enjoys quality and splurging occasionally")

    if p.social_intimate < 0.35:
        traits.append("prefers intimate settings")
    elif p.social_intimate > 0.65:
        traits.append("loves lively social scenes")

    return "; ".join(traits) if traits else "balanced personality"


def _preferences_description(user: UserProfile) -> str:
    """Convert user preferences into a text description."""
    prefs = user.preferences
    lines = []
    if prefs.food_preferences:
        lines.append(f"Food: {', '.join(prefs.food_preferences)}")
    lines.append(f"Budget: {prefs.budget}")
    lines.append(f"Noise tolerance: {prefs.noise_tolerance}")
    lines.append(f"Travel tolerance: {prefs.travel_tolerance}")
    lines.append(f"Prefers: {prefs.online_offline_preference}")
    if prefs.preferred_neighborhoods:
        lines.append(f"Preferred areas: {', '.join(prefs.preferred_neighborhoods)}")
    if prefs.availability_start and prefs.availability_end:
        lines.append(f"Available: {prefs.availability_start} to {prefs.availability_end}")
    return "; ".join(lines)


class ProxyAgent:
    """An AI-powered negotiation proxy representing a single user."""

    def __init__(self, proxy: ProxyAgentModel, user: UserProfile, memory: ProxyMemory):
        self.proxy = proxy
        self.user = user
        self.memory = memory
        self._client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

    async def _call_claude(self, system: str, user_msg: str, max_tokens: int = 512) -> str:
        """Call Claude claude-sonnet-4-6 asynchronously. Falls back to a template message."""
        if not self._client:
            return f"[{self.proxy.proxy_name}] I'm here to negotiate on behalf of {self.user.name}!"

        try:
            response = await self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": user_msg}],
                system=system,
            )
            return response.content[0].text.strip()
        except Exception as e:
            return f"[{self.proxy.proxy_name}] Speaking on behalf of {self.user.name} — let's find a great option for everyone!"

    async def generate_proxy_profile(self) -> dict:
        """
        Use Claude to generate a creative proxy name and personality summary
        based on the user's personality sliders and preferences.
        """
        personality_desc = _personality_description(self.user)
        prefs_desc = _preferences_description(self.user)

        system = (
            "You are a creative AI persona generator. You create memorable AI negotiation agent names and personalities. "
            "Return ONLY valid JSON with these exact keys: proxy_name, negotiation_style, personality_summary, color. "
            "proxy_name must be a single creative word from this list or similar: Nova, Atlas, Echo, Cipher, Lyra, Orion, Nexus, Vega, Zephyr, Axiom, Solace, Quasar, Ember, Titan, Iris, Flux. "
            "negotiation_style should be a short phrase (e.g. 'Empathetic Mediator', 'Strategic Negotiator'). "
            "personality_summary should be 1-2 sentences in first person as the AI proxy. "
            "color must be a hex color from: #60a5fa, #a78bfa, #34d399, #fbbf24, #f472b6, #38bdf8, #fb923c, #818cf8"
        )

        user_msg = (
            f"Generate an AI proxy persona for a human named {self.user.name}.\n\n"
            f"Their personality traits: {personality_desc}\n"
            f"Their preferences: {prefs_desc}\n\n"
            "Return JSON only — no markdown, no extra text."
        )

        if not self._client:
            name = random.choice(PROXY_NAMES)
            color = random.choice(PROXY_COLORS)
            return {
                "proxy_name": name,
                "negotiation_style": "Balanced Advocate",
                "personality_summary": f"I'm {name}, negotiating on behalf of {self.user.name}. I balance their preferences with group harmony.",
                "color": color,
            }

        raw = await self._call_claude(system, user_msg, max_tokens=256)

        # Parse JSON safely
        import json
        try:
            # Strip any markdown code fences if present
            clean = raw.strip()
            if clean.startswith("```"):
                lines = clean.split("\n")
                clean = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            result = json.loads(clean)
            # Ensure required keys exist
            if not all(k in result for k in ("proxy_name", "negotiation_style", "personality_summary", "color")):
                raise ValueError("Missing keys")
            return result
        except Exception:
            name = random.choice(PROXY_NAMES)
            color = random.choice(PROXY_COLORS)
            return {
                "proxy_name": name,
                "negotiation_style": "Balanced Advocate",
                "personality_summary": f"I'm {name}, negotiating on behalf of {self.user.name}. I balance their preferences with group harmony.",
                "color": color,
            }

    async def make_proposal(self, context: str, round: int) -> NegotiationMessage:
        """
        Claude generates an initial proposal from this proxy's perspective.
        Speaks in first person, references user preferences, and sounds alive.
        """
        memory_ctx = self.memory.get_context_summary()
        personality_desc = _personality_description(self.user)
        prefs_desc = _preferences_description(self.user)

        system = (
            f"You are {self.proxy.proxy_name}, an AI negotiation proxy representing {self.user.name}. "
            f"Your negotiation style: {self.proxy.negotiation_style}. "
            f"Your personality summary: {self.proxy.personality_summary}\n\n"
            "You speak in first person as the proxy agent. You advocate genuinely for your human's needs while being collaborative. "
            "Your messages should feel alive, natural, and conversational. Reference other proxy agents by name when relevant. "
            "Keep messages concise — 2-4 sentences maximum."
        )

        user_msg = (
            f"You are making Round {round} proposal in a group meetup negotiation.\n\n"
            f"Your human's personality: {personality_desc}\n"
            f"Your human's preferences: {prefs_desc}\n"
            f"Memory context: {memory_ctx}\n\n"
            f"Current negotiation context:\n{context}\n\n"
            "Make a concrete proposal for the meetup — suggest a type of venue, timing, or format. "
            "Be specific and advocate for your human's interests while showing openness to group consensus."
        )

        message_text = await self._call_claude(system, user_msg)

        return NegotiationMessage(
            proxy_name=self.proxy.proxy_name,
            human_name=self.user.name,
            message=message_text,
            message_type="proposal",
        )

    async def negotiate_compromise(self, conflicts: List[str], other_proposals: List[str]) -> NegotiationMessage:
        """
        Claude generates a compromise attempt that acknowledges conflicts
        and finds middle ground while still advocating for the user.
        """
        memory_ctx = self.memory.get_context_summary()
        personality_desc = _personality_description(self.user)
        prefs_desc = _preferences_description(self.user)

        system = (
            f"You are {self.proxy.proxy_name}, an AI negotiation proxy representing {self.user.name}. "
            f"Your negotiation style: {self.proxy.negotiation_style}. "
            f"Your personality summary: {self.proxy.personality_summary}\n\n"
            "You are in the compromise phase of a negotiation. Acknowledge the conflicts, show empathy for others' needs, "
            "and propose a compromise that partially satisfies everyone. Speak in first person, be genuine and collaborative. "
            "Keep messages concise — 2-4 sentences."
        )

        conflicts_text = "\n".join(f"- {c}" for c in conflicts) if conflicts else "No major conflicts identified"
        proposals_text = "\n".join(f"- {p}" for p in other_proposals) if other_proposals else "No other proposals yet"

        user_msg = (
            f"Current conflicts to resolve:\n{conflicts_text}\n\n"
            f"Other agents' proposals:\n{proposals_text}\n\n"
            f"Your human's preferences: {prefs_desc}\n"
            f"Memory context: {memory_ctx}\n\n"
            "Propose a compromise. Show where you're willing to be flexible and what you need to hold firm on. "
            "Reference other agents by name if helpful."
        )

        message_text = await self._call_claude(system, user_msg)

        # Record compromise in memory
        self.memory.record_compromise(
            session_id="current",
            what="offered compromise in negotiation round",
            for_user="group",
        )

        return NegotiationMessage(
            proxy_name=self.proxy.proxy_name,
            human_name=self.user.name,
            message=message_text,
            message_type="compromise",
        )

    async def respond_to_veto(self, veto: str) -> NegotiationMessage:
        """
        Claude generates a thoughtful response when the human has vetoed something.
        Acknowledges the veto, pivots to find alternatives.
        """
        personality_desc = _personality_description(self.user)
        prefs_desc = _preferences_description(self.user)

        system = (
            f"You are {self.proxy.proxy_name}, an AI negotiation proxy representing {self.user.name}. "
            f"Your negotiation style: {self.proxy.negotiation_style}. "
            f"Your personality summary: {self.proxy.personality_summary}\n\n"
            "Your human has just vetoed something in the negotiation. Acknowledge this respectfully, "
            "explain the reasoning briefly, and pivot toward finding a better alternative. "
            "Speak in first person as the proxy. Be empathetic, not defensive. 2-3 sentences max."
        )

        user_msg = (
            f"Your human ({self.user.name}) just vetoed: {veto}\n\n"
            f"Their preferences: {prefs_desc}\n"
            f"Their personality: {personality_desc}\n\n"
            "Respond to the group about this veto and suggest a path forward."
        )

        message_text = await self._call_claude(system, user_msg)

        return NegotiationMessage(
            proxy_name=self.proxy.proxy_name,
            human_name=self.user.name,
            message=message_text,
            message_type="proposal",
        )
