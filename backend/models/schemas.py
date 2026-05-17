from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Dict, Any, Union
from enum import Enum
import uuid
from datetime import datetime


class MeetupTemplate(str, Enum):
    DINNER_NIGHT = "dinner_night"
    CHILL_HANGOUT = "chill_hangout"
    STARTUP_BRAINSTORM = "startup_brainstorm"
    STUDY_SESSION = "study_session"
    REMOTE_COWORKING = "remote_coworking"
    CUSTOM_MEETUP = "custom_meetup"
    CUSTOM = "custom"  # alias accepted from frontend


class PersonalitySliders(BaseModel):
    diplomatic_assertive: float = Field(0.5, ge=0, le=100)
    practical_adventurous: float = Field(0.5, ge=0, le=100)
    flexible_stubborn: float = Field(0.5, ge=0, le=100)
    concise_expressive: float = Field(0.5, ge=0, le=100)
    analytical_emotional: float = Field(0.5, ge=0, le=100)
    cheap_luxury: float = Field(0.5, ge=0, le=100)
    social_intimate: float = Field(0.5, ge=0, le=100)

    @model_validator(mode="after")
    def normalize_range(self):
        """Accept 0-100 from frontend; normalize anything >1 to 0-1 scale."""
        fields = [
            "diplomatic_assertive", "practical_adventurous", "flexible_stubborn",
            "concise_expressive", "analytical_emotional", "cheap_luxury", "social_intimate",
        ]
        for f in fields:
            v = getattr(self, f)
            if v > 1.0:
                setattr(self, f, v / 100.0)
        return self


class MeetupPreferences(BaseModel):
    food_preferences: List[str] = []
    noise_tolerance: str = "medium"
    travel_tolerance: str = "medium"
    budget: str = "medium"
    preferred_neighborhoods: List[str] = []
    online_offline_preference: str = "either"
    online_offline: Optional[str] = None  # frontend alias
    availability_start: Optional[str] = None
    availability_end: Optional[str] = None
    location: Optional[Union[str, Dict[str, float]]] = None  # frontend sends string

    @model_validator(mode="after")
    def resolve_aliases(self):
        if self.online_offline and not self.online_offline_preference:
            self.online_offline_preference = self.online_offline
        return self


class UserProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None  # frontend sends user_id; we copy it to id
    name: str
    avatar: str = "🤖"
    avatar_emoji: Optional[str] = None  # frontend alias for avatar
    personality: PersonalitySliders = PersonalitySliders()
    preferences: MeetupPreferences = MeetupPreferences()
    room_id: str = ""

    @model_validator(mode="after")
    def resolve_aliases(self):
        if self.user_id and self.id == self.id:  # prefer user_id if provided
            self.id = self.user_id
        if self.avatar_emoji:
            self.avatar = self.avatar_emoji
        return self


class ProxyAgent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    proxy_name: str
    human_name: str
    user_id: str
    negotiation_style: str
    personality_summary: str
    color: str = "#60a5fa"


class NegotiationMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    proxy_name: str
    human_name: str
    message: str
    message_type: str = "proposal"  # proposal/conflict/compromise/consensus/resolver
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    is_thinking: bool = False


class FairnessMetrics(BaseModel):
    group_alignment: float = 0.0
    travel_fairness: float = 0.0
    budget_harmony: float = 0.0
    compromise_balance: float = 0.0
    social_balance: float = 0.0


class VenueProposal(BaseModel):
    name: str
    address: str
    type: str
    rating: Optional[float] = None
    price_level: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    proposed_by: str
    score: float = 0.0


class ConsensusResult(BaseModel):
    achieved: bool = False
    alignment_score: float = 0.0
    venue: Optional[VenueProposal] = None
    time: Optional[str] = None
    format: str = ""
    backup_plan: Optional[str] = None
    fairness_score: str = "Good"
    limiting_factors: List[Dict[str, str]] = []
    contribution_summary: List[Dict[str, str]] = []
    badges_awarded: List[Dict[str, str]] = []


class RoomState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    template: MeetupTemplate = MeetupTemplate.CUSTOM_MEETUP
    location: Optional[str] = None
    time_range: Optional[str] = None
    users: Dict[str, UserProfile] = {}
    proxies: Dict[str, ProxyAgent] = {}
    messages: List[NegotiationMessage] = []
    fairness: FairnessMetrics = FairnessMetrics()
    consensus: Optional[ConsensusResult] = None
    negotiation_round: int = 0
    status: str = "waiting"  # waiting/onboarding/negotiating/consensus
    created_at: datetime = Field(default_factory=datetime.utcnow)
    weather_context: Optional[str] = None
    venues: List[VenueProposal] = []


class CreateRoomRequest(BaseModel):
    name: Optional[str] = None
    room_name: Optional[str] = None  # frontend alias for name
    template: MeetupTemplate = MeetupTemplate.CUSTOM_MEETUP
    location: Optional[str] = None
    time_range: Optional[str] = None
    time_range_start: Optional[str] = None  # frontend sends start/end separately
    time_range_end: Optional[str] = None

    @property
    def resolved_name(self) -> str:
        return self.name or self.room_name or "Untitled Room"

    @property
    def resolved_time_range(self) -> Optional[str]:
        if self.time_range:
            return self.time_range
        if self.time_range_start or self.time_range_end:
            parts = [p for p in [self.time_range_start, self.time_range_end] if p]
            return " - ".join(parts)
        return None


class JoinRoomRequest(BaseModel):
    user_profile: UserProfile


class RelaxConstraintRequest(BaseModel):
    user_id: str
    constraint_type: str  # travel/budget/time/noise
    new_value: str


class VetoRequest(BaseModel):
    user_id: str
    veto_target: str
    reason: str


class WebSocketMessage(BaseModel):
    type: str
    data: Dict[str, Any] = {}
