import type {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  RelaxConstraintRequest,
  RoomState,
  UserProfile,
  VenueProposal,
  VetoRequest,
} from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `API error ${res.status}`;
    try {
      const body = await res.json();
      errorMessage = body.detail ?? body.message ?? errorMessage;
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Transform backend RoomState → frontend RoomState
// The backend uses different field names (id, name, fairness, venues, etc.)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeVenue(v: any, i: number): any {
  return {
    ...v,
    venue_id: v.venue_id || v.id || `venue-${i}`,
    venue_type: v.venue_type ?? v.type ?? "",
    latitude: v.latitude ?? v.lat ?? null,
    longitude: v.longitude ?? v.lng ?? null,
    price_level: v.price_level ?? 2,
    votes_for: v.votes_for ?? [],
    votes_against: v.votes_against ?? [],
    proposed_by: v.proposed_by ?? "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeConsensus(c: any): any {
  if (!c) return null;
  // Backend uses: alignment_score, time, format, fairness_score (str)
  // Frontend expects: alignment_percentage, meeting_time, meeting_format, fairness_score (num)
  const contributionSummary = c.contribution_summary ?? {};
  // Backend may send array [{proxy, contribution}] or object {name: text}
  const normalized: Record<string, string> = Array.isArray(contributionSummary)
    ? Object.fromEntries(
        contributionSummary.map((item: Record<string, string>) => [
          item.proxy ?? item.name ?? "?",
          item.contribution ?? item.summary ?? "",
        ])
      )
    : contributionSummary;

  return {
    ...c,
    achieved: c.achieved ?? false,
    alignment_percentage: c.alignment_percentage ?? c.alignment_score ?? 0,
    meeting_time: c.meeting_time ?? c.time ?? "",
    meeting_format: c.meeting_format ?? c.format ?? "either",
    fairness_score: typeof c.fairness_score === "number" ? c.fairness_score : 75,
    contribution_summary: normalized,
    badges_awarded: c.badges_awarded ?? [],
    venue: c.venue
      ? {
          ...c.venue,
          venue_id: c.venue.venue_id ?? c.venue.id ?? "",
          venue_type: c.venue.venue_type ?? c.venue.type ?? "",
          price_level: c.venue.price_level ?? 2,
          votes_for: c.venue.votes_for ?? [],
          votes_against: c.venue.votes_against ?? [],
          proposed_by: c.venue.proposed_by ?? "",
        }
      : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProxy(p: any): any {
  return {
    ...p,
    proxy_id: p.proxy_id ?? p.id ?? "",
    avatar_emoji: p.avatar_emoji ?? p.avatar ?? "🤖",
    color_index: p.color_index ?? 0,
    is_thinking: p.is_thinking ?? false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeUser(u: any): any {
  return {
    ...u,
    user_id: u.user_id ?? u.id ?? "",
    avatar_emoji: u.avatar_emoji ?? u.avatar ?? "🤖",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRoom(raw: any): RoomState {
  const rawUsers = Array.isArray(raw.users) ? raw.users : Object.values(raw.users ?? {});
  const rawProxies = Array.isArray(raw.proxies) ? raw.proxies : Object.values(raw.proxies ?? {});
  return {
    room_id: raw.room_id ?? raw.id ?? "",
    room_name: raw.room_name ?? raw.name ?? "Untitled Room",
    template: raw.template,
    status: raw.status ?? "waiting",
    created_at: raw.created_at ?? new Date().toISOString(),
    host_id: raw.host_id ?? "",
    users: rawUsers.map(normalizeUser),
    proxies: rawProxies.map(normalizeProxy),
    messages: raw.messages ?? [],
    fairness_metrics: raw.fairness_metrics ?? raw.fairness ?? {
      group_alignment: 0,
      travel_fairness: 0,
      budget_harmony: 0,
      compromise_balance: 0,
    },
    consensus: raw.consensus ? normalizeConsensus(raw.consensus) : null,
    venue_proposals: (raw.venue_proposals ?? raw.venues ?? []).map(normalizeVenue),
    max_users: raw.max_users ?? 6,
  };
}

export async function createRoom(
  data: CreateRoomRequest
): Promise<CreateRoomResponse> {
  return request<CreateRoomResponse>("/api/rooms", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getRoom(roomId: string): Promise<RoomState> {
  const raw = await request<unknown>(`/api/rooms/${roomId}`);
  return normalizeRoom(raw);
}

export async function joinRoom(
  roomId: string,
  userProfile: UserProfile
): Promise<{ user_id: string; room_id: string; user_count: number }> {
  const payload: JoinRoomRequest = { user_profile: userProfile };
  return request(`/api/rooms/${roomId}/join`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startNegotiation(roomId: string): Promise<{ status: string }> {
  return request(`/api/rooms/${roomId}/start`, {
    method: "POST",
  });
}

export async function relaxConstraint(
  roomId: string,
  data: RelaxConstraintRequest
): Promise<unknown> {
  return request(`/api/rooms/${roomId}/relax`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function vetoProposal(
  roomId: string,
  data: VetoRequest
): Promise<unknown> {
  return request(`/api/rooms/${roomId}/veto`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getVenues(roomId: string): Promise<VenueProposal[]> {
  const raw = await request<unknown[]>(`/api/rooms/${roomId}/venues`);
  return raw.map(normalizeVenue);
}
