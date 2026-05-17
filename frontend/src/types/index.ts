// Enums
export enum MeetupTemplate {
  DINNER_NIGHT = "dinner_night",
  CHILL_HANGOUT = "chill_hangout",
  STARTUP_BRAINSTORM = "startup_brainstorm",
  STUDY_SESSION = "study_session",
  REMOTE_COWORKING = "remote_coworking",
  CUSTOM = "custom",
}

export enum NoiseTolerance {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export enum TravelTolerance {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export enum BudgetLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  LUXURY = "luxury",
}

export enum OnlineOfflinePreference {
  ONLINE = "online",
  OFFLINE = "offline",
  EITHER = "either",
}

export enum MessageType {
  PROPOSAL = "proposal",
  CONFLICT = "conflict",
  COMPROMISE = "compromise",
  RESOLVER = "resolver",
  INFO = "info",
}

export enum RoomStatus {
  WAITING = "waiting",
  NEGOTIATING = "negotiating",
  CONSENSUS = "consensus",
  FAILED = "failed",
}

// Core interfaces
export interface PersonalitySliders {
  diplomatic_assertive: number; // 0-100, 0=diplomatic, 100=assertive
  practical_adventurous: number;
  flexible_stubborn: number;
  concise_expressive: number;
  analytical_emotional: number;
  cheap_luxury: number;
  social_intimate: number;
}

export interface MeetupPreferences {
  food_preferences: string[];
  noise_tolerance: NoiseTolerance;
  travel_tolerance: TravelTolerance;
  budget: BudgetLevel;
  online_offline: OnlineOfflinePreference;
  availability_start: string; // HH:MM format
  availability_end: string;
  location: string;
}

export interface UserProfile {
  user_id: string;
  name: string;
  avatar_emoji: string;
  personality: PersonalitySliders;
  preferences: MeetupPreferences;
}

export interface ProxyAgent {
  proxy_id: string;
  user_id: string;
  proxy_name: string;
  human_name: string;
  avatar_emoji: string;
  personality: PersonalitySliders;
  preferences: MeetupPreferences;
  is_thinking: boolean;
  color_index: number;
}

export interface NegotiationMessage {
  message_id: string;
  proxy_id: string;
  proxy_name: string;
  human_name: string;
  avatar_emoji: string;
  content: string;
  message_type: MessageType;
  timestamp: string;
  target_proxy_id?: string;
}

export interface FairnessMetrics {
  group_alignment: number; // 0-100
  travel_fairness: number;
  budget_harmony: number;
  compromise_balance: number;
}

export interface VenueProposal {
  venue_id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  venue_type: string;
  price_level: number; // 1-4
  rating?: number;
  proposed_by: string; // proxy_id
  votes_for: string[];
  votes_against: string[];
}

export interface BadgeAward {
  badge_id: string;
  badge_name: string;
  badge_emoji: string;
  description: string;
  awarded_to: string; // user_id
  awarded_to_name: string;
}

export interface ConsensusResult {
  achieved: boolean;
  venue: VenueProposal | null;
  meeting_time: string;
  meeting_format: OnlineOfflinePreference;
  backup_plan?: string;
  fairness_score: number;
  alignment_percentage: number;
  contribution_summary: Record<string, string>;
  badges_awarded: BadgeAward[];
}

export interface RoomState {
  room_id: string;
  room_name: string;
  template: MeetupTemplate;
  status: RoomStatus;
  created_at: string;
  host_id: string;
  users: UserProfile[];
  proxies: ProxyAgent[];
  messages: NegotiationMessage[];
  fairness_metrics: FairnessMetrics;
  consensus: ConsensusResult | null;
  venue_proposals: VenueProposal[];
  max_users: number;
}

// WebSocket message types
export type WebSocketMessageType =
  | "room_state"
  | "room_update"
  | "proxy_message"
  | "fairness_update"
  | "consensus_reached"
  | "proxy_thinking"
  | "participant_connected"
  | "participant_disconnected"
  | "user_joined"
  | "user_left"
  | "negotiation_started"
  | "negotiation_message"
  | "venue_proposed"
  | "connected"
  | "pong"
  | "chat"
  | "consensus_achieved"
  | "negotiation_error"
  | "human_checkpoint"
  | "error";

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: unknown;
  timestamp: string;
}

// API request/response types
export interface CreateRoomRequest {
  template: MeetupTemplate;
  room_name: string;
  location?: string;
  time_range_start?: string;
  time_range_end?: string;
}

export interface CreateRoomResponse {
  room_id: string;
  room_name: string;
  template: MeetupTemplate;
  status: RoomStatus;
  created_at: string;
  host_id: string;
}

export interface JoinRoomRequest {
  user_profile: UserProfile;
}

export interface RelaxConstraintRequest {
  constraint_type: string;
  new_value: unknown;
  proxy_id: string;
}

export interface VetoRequest {
  proxy_id: string;
  venue_id: string;
  reason: string;
}
