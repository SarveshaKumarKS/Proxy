# Proxy — Project Context & Status
*Last updated: 2026-05-17. Use this file to resume work in any LLM.*

---

## What Is Proxy?

A real-time multiplayer AI meetup coordination platform. Multiple humans each join a room, set their preferences (food, budget, travel tolerance, personality sliders), and AI "proxy agents" (powered by Claude Sonnet) negotiate on their behalf to reach a consensus on a venue, time, and format. The result is displayed on an interactive map showing travel fairness.

**Demo flow:** Create room → Share link → All users join and fill preferences → Host starts negotiation → Watch proxies debate live → Consensus card shows the result → Map page shows venue with travel times.

---

## Repository Layout

```
/
├── backend/                   # FastAPI + LangGraph + Claude
│   ├── main.py                # App entrypoint, mounts routers
│   ├── agents/
│   │   ├── orchestrator.py    # LangGraph 7-step pipeline
│   │   ├── proxy_agent.py     # Individual Claude-powered proxy
│   │   └── resolver_agent.py  # Conflict detection + consensus generator
│   ├── models/
│   │   └── schemas.py         # Pydantic models (RoomState, UserProfile, etc.)
│   ├── routers/
│   │   ├── rooms.py           # REST endpoints (/api/rooms/*)
│   │   └── websocket.py       # WS endpoint (/ws/{room_id})
│   ├── services/
│   │   ├── places.py          # Google Places API (with mock fallback)
│   │   ├── fairness.py        # FairnessMetrics computation
│   │   └── weather.py         # OpenWeather context
│   ├── memory/
│   │   └── store.py           # Per-proxy JSON memory (data/*.json)
│   ├── .env                   # Real secrets (not committed)
│   ├── .env.example           # Template
│   └── requirements.txt
│
└── frontend/                  # Next.js 16 + TypeScript + Tailwind
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx               # Landing page (create room)
    │   │   ├── join/[roomId]/page.tsx # Join flow (preferences form)
    │   │   ├── room/[roomId]/
    │   │   │   ├── page.tsx           # Main negotiation room
    │   │   │   └── map/page.tsx       # Travel fairness map
    │   │   └── layout.tsx
    │   ├── components/
    │   │   ├── negotiation/
    │   │   │   ├── HumanControls.tsx  # Sidebar: participants, start button, veto
    │   │   │   ├── LiveFeed.tsx       # Scrolling negotiation message feed
    │   │   │   ├── ConsensusCard.tsx  # Final consensus display
    │   │   │   ├── ConsensusMetrics.tsx
    │   │   │   └── NegotiationGraph.tsx # React Flow proxy graph
    │   │   └── map/
    │   │       └── FairnessMap.tsx    # Mapbox GL map + static fallback
    │   ├── stores/
    │   │   └── roomStore.ts           # Zustand store — all WS event handling
    │   ├── lib/
    │   │   └── api.ts                 # REST API calls + normalization layer
    │   ├── hooks/
    │   │   └── useWebSocket.ts
    │   └── types/
    │       └── index.ts               # All TypeScript interfaces/enums
    └── .env.local                     # Frontend env vars
```

---

## Environment Variables

### Backend (`backend/.env`)
```
ANTHROPIC_API_KEY=sk-ant-...         # Claude Sonnet for proxy agents
GOOGLE_PLACES_API_KEY=...            # Optional — has mock fallback
OPENWEATHER_API_KEY=...              # Optional — has fallback
MAPBOX_TOKEN=pk.eyJ1...              # Mapbox (used by frontend too)
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1ijoidGhhbGFwYXRoeS02OSIsImEiOiJjbXBhOWVldDUwY3VvMnJvZWQwdjRqMWVnIn0.7cIRZ8ysBDlD3q8f_l3Otw
```

---

## How to Run

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # runs on http://localhost:3000
```

---

## Critical Architecture: Backend vs Frontend Field Name Mismatch

This is the single biggest source of bugs. The backend and frontend use DIFFERENT field names everywhere. There is a normalization layer in `frontend/src/lib/api.ts` that translates on REST responses, and a similar normalization in `frontend/src/stores/roomStore.ts` for WebSocket events.

| Concept | Backend field | Frontend field |
|---|---|---|
| Room ID | `id` | `room_id` |
| Room name | `name` | `room_name` |
| Fairness object | `fairness` (FairnessMetrics) | `fairness_metrics` |
| Venues list | `venues` | `venue_proposals` |
| Venue ID | *(none — VenueProposal has no id field)* | `venue_id` |
| Venue lat | `lat` | `latitude` |
| Venue lng | `lng` | `longitude` |
| Venue type | `type` | `venue_type` |
| Proxy ID | `id` | `proxy_id` |
| Proxy color | `color` (hex string) | `color_index` (int, used with `getProxyColor(i)`) |
| User avatar | `avatar` | `avatar_emoji` |
| Consensus alignment | `alignment_score` | `alignment_percentage` |
| Consensus time | `time` | `meeting_time` |
| Consensus format | `format` | `meeting_format` |
| Message content | `message` | `content` |
| Message ID | `id` | `message_id` |

**Backend `users` and `proxies` are `Dict[str, Model]`** — the frontend must call `Object.values()` to convert to arrays. The `normalizeRoom()` function in both `api.ts` and `roomStore.ts` handles this.

**`??` vs `||`:** Use `||` (not `??`) for ID fields because the backend sometimes sends empty string `""` which is falsy but not nullish.

---

## WebSocket Event Reference

Backend broadcasts these event types; frontend `roomStore.ts` must handle each:

| Event type | Payload shape | Frontend action |
|---|---|---|
| `room_state` | Full `RoomState` dict | Replace entire room via `normalizeRoom()` |
| `room_update` | Partial: `{status?, proxies?, fairness?}` OR full room | Merge partial or replace full |
| `negotiation_message` | `{message: {proxy_name, human_name, message, message_type, ...}}` | Append to `room.messages` |
| `fairness_update` | `{fairness: {group_alignment, travel_fairness, budget_harmony, compromise_balance}}` | Update `fairness_metrics` |
| `consensus_achieved` | `{consensus: ConsensusResult, fairness: {...}}` | Set consensus, trigger ConsensusCard |
| `consensus_reached` | Same as above (legacy alias) | Same |
| `proxy_thinking` | `{proxyId, isThinking}` | Toggle thinking indicator |
| `human_checkpoint` | `{message, fairness, venues}` | Informational |
| `negotiation_error` | `{error, message}` | Show error toast |

---

## Negotiation Pipeline (LangGraph 7 Nodes)

1. **`collect_preferences`** — fetches weather, sets `room.status = "negotiating"`, broadcasts full `room_state`
2. **`generate_proxies`** — calls Claude to create proxy profiles for all users in parallel, broadcasts each proxy intro message + full `room_state`
3. **`parallel_proposals`** — searches venues (Google Places or mock), each proxy makes initial proposal, broadcasts `negotiation_message` per proxy, then `fairness_update`
4. **`detect_conflicts`** — resolver LLM finds disagreements, broadcasts conflict message
5. **`negotiate_rounds`** — 2 rounds of compromise; each proxy responds, resolver synthesizes, `fairness_update` after each round
6. **`human_checkpoint`** — broadcasts fairness summary + `human_checkpoint` event (humans can veto via REST)
7. **`generate_consensus`** — resolver generates final `ConsensusResult`, broadcasts `consensus_achieved` + `room_update`

---

## Proxy Agent Architecture

`ProxyAgent` (in `agents/proxy_agent.py`) wraps a `ProxyAgentModel` + `UserProfile` + `ProxyMemory`. It makes 3 types of Claude calls:
- `generate_proxy_profile()` — creates the proxy persona
- `make_proposal(context, round)` — initial venue proposal
- `negotiate_compromise(conflicts, other_proposals)` — round 2/3 compromise

`ResolverAgent` (in `agents/resolver_agent.py`) is a separate Claude agent that:
- `detect_conflicts(messages)` — finds disagreements
- `generate_compromise_proposal(room, venues)` — synthesizes a compromise
- `compute_fairness_summary(room)` — narrative fairness analysis
- `generate_final_consensus(room, venues)` — produces `ConsensusResult`

---

## Data Models (Backend Pydantic)

```python
# VenueProposal — NOTE: no venue_id field, no votes_for/votes_against
class VenueProposal(BaseModel):
    name: str
    address: str
    type: str          # frontend expects venue_type
    rating: Optional[float]
    price_level: Optional[int]
    lat: Optional[float]   # frontend expects latitude
    lng: Optional[float]   # frontend expects longitude
    proposed_by: str
    score: float = 0.0

# ConsensusResult — NOTE: fairness_score is a STRING not a number
class ConsensusResult(BaseModel):
    achieved: bool = False
    alignment_score: float = 0.0   # frontend expects alignment_percentage
    venue: Optional[VenueProposal]
    time: Optional[str]            # frontend expects meeting_time
    format: str = ""               # frontend expects meeting_format
    fairness_score: str = "Good"   # frontend expects number — normalize to 75
    contribution_summary: List[Dict[str, str]]  # frontend expects Record<string,string>
    badges_awarded: List[Dict[str, str]]

# RoomState — NOTE: users/proxies are Dict not List
class RoomState(BaseModel):
    id: str                        # frontend expects room_id
    name: str                      # frontend expects room_name
    fairness: FairnessMetrics      # frontend expects fairness_metrics
    venues: List[VenueProposal]    # frontend expects venue_proposals
    users: Dict[str, UserProfile]
    proxies: Dict[str, ProxyAgent]
    status: str  # waiting / onboarding / negotiating / consensus
```

---

## Current Status: What Works

- ✅ Room creation and joining
- ✅ Multiple users joining shows correct participant count (uses `room.users.length`)
- ✅ "Start Negotiation" button enables when `room.users.length >= 2`
- ✅ WebSocket connection with auto-reconnect
- ✅ Negotiation pipeline runs (LangGraph 7 nodes execute)
- ✅ Live feed receives and displays `negotiation_message` events
- ✅ Fairness metrics animate correctly (NaN was fixed)
- ✅ `ConsensusCard` appears and renders without crashing
- ✅ Map page loads and shows venue list in sidebar
- ✅ Duplicate key warnings fixed (`venue_id || i` fallback)
- ✅ Static fallback map works when no Mapbox token

---

## Current Issue: Map Not Showing (UNRESOLVED)

**Symptom:** Navigating to `/room/[roomId]/map` — the map area stays blank/dark. No Mapbox map renders even though `NEXT_PUBLIC_MAPBOX_TOKEN` is set.

**Error in console:**
```
This page appears to be missing CSS declarations for Mapbox GL JS, which may cause 
the map to display incorrectly. Please ensure your page includes mapbox-gl.css
```

**What was tried:**
1. Added `import "mapbox-gl/dist/mapbox-gl.css"` inside `FairnessMap.tsx` (the dynamically-loaded component) — did not work because CSS inside `next/dynamic` chunks loads too late
2. Moved the import to `map/page.tsx` (the parent page) — Mapbox still complains about missing CSS

**Root cause analysis:**
The CSS warning is a red herring. The map failing to render is more likely one of:

1. **`mapContainerRef.current` is null when the effect runs** — `FairnessMap` is loaded via `next/dynamic` with `ssr: false`. The `useEffect` runs after the component mounts but the `div` ref might not be connected yet.
2. **`mapboxError` is set to `true` prematurely** — The effect checks `if (!MAPBOX_TOKEN || !mapContainerRef.current)` and sets `mapboxError = true`, which triggers the `StaticMapFallback`. If `mapContainerRef.current` is briefly null on first render, the map falls back to the static view permanently.
3. **The `useEffect` dep array `[MAPBOX_TOKEN, venue, travelData]`** — `travelData` is a `useMemo` value that may still change reference even with stable offsets, causing the effect to re-run and destroy the map.

**Recommended fix to try:**

In `FairnessMap.tsx`, change the early-return logic. Instead of setting `mapboxError = true` when `mapContainerRef.current` is null, **wait for it**:

```tsx
useEffect(() => {
  if (!MAPBOX_TOKEN) {
    setMapboxError(true);
    return;
  }
  // Don't bail on missing ref — it might not be mounted yet
  if (!mapContainerRef.current) return;  // just return, don't set error
  
  // ... rest of effect
}, [MAPBOX_TOKEN, venue, travelData]);
```

Also add a **second effect** that fires only once to check if the container ever appears:
```tsx
useEffect(() => {
  if (!MAPBOX_TOKEN) setMapboxError(true);
}, [MAPBOX_TOKEN]);
```

**Alternative fix:** Move Mapbox initialization into a callback ref instead of `useEffect`:
```tsx
const mapContainerRef = useCallback((node: HTMLDivElement | null) => {
  if (node && MAPBOX_TOKEN) {
    // initialize map here
  }
}, []);
```

**Another alternative:** Add a CSS import directly in `frontend/src/app/layout.tsx`:
```tsx
import "mapbox-gl/dist/mapbox-gl.css";
```
This guarantees the CSS is always loaded regardless of dynamic imports.

---

## Other Known Issues / TODOs

### Minor
- `data-darkreader-*` hydration warning — caused by Dark Reader browser extension injecting attributes onto `<html>`. Not a code bug, safe to ignore or suppress with `suppressHydrationWarning` on `<html>`.
- Proxy `color_index` vs `color` — backend sends hex color string, frontend expects int index for `getProxyColor(i)`. Currently `color_index` defaults to 0 so all proxies get the same color. Fix: compute `color_index` from position in the proxies array after normalization.

### Features Not Yet Built
- Real travel time calculation (currently uses random offsets from venue coordinates)
- Veto UI actually sending to backend (UI exists in HumanControls, endpoint exists in rooms.py)
- Constraint relaxation UI
- Badge display in ConsensusCard
- Reconnect handling when user refreshes mid-negotiation

---

## Key Files Reference

| File | Purpose |
|---|---|
| `backend/agents/orchestrator.py` | LangGraph pipeline — edit to change negotiation flow |
| `backend/agents/proxy_agent.py` | Claude prompts for proxy personas |
| `backend/agents/resolver_agent.py` | Conflict detection + consensus generation |
| `backend/models/schemas.py` | All Pydantic models — source of truth for backend types |
| `backend/routers/rooms.py` | REST API endpoints |
| `backend/routers/websocket.py` | WebSocket connection manager |
| `backend/services/places.py` | Google Places + mock venue data |
| `frontend/src/stores/roomStore.ts` | Zustand store — ALL WebSocket event handling lives here |
| `frontend/src/lib/api.ts` | REST calls + normalization (normalizeRoom, normalizeVenue, etc.) |
| `frontend/src/types/index.ts` | TypeScript interfaces — source of truth for frontend types |
| `frontend/src/app/room/[roomId]/page.tsx` | Main negotiation UI |
| `frontend/src/app/room/[roomId]/map/page.tsx` | Map page |
| `frontend/src/components/map/FairnessMap.tsx` | Mapbox GL map component |
| `frontend/src/components/negotiation/HumanControls.tsx` | Participants sidebar + start button |
| `frontend/src/components/negotiation/LiveFeed.tsx` | Scrolling message feed |
| `frontend/src/components/negotiation/ConsensusCard.tsx` | Final consensus display |

---

## Normalization Functions (copy-reference)

### `normalizeVenue` (api.ts and roomStore.ts should match)
```ts
function normalizeVenue(v: any, i: number): any {
  return {
    ...v,
    venue_id: v.venue_id || v.id || `venue-${i}`,   // || not ?? (empty string check)
    venue_type: v.venue_type ?? v.type ?? "",
    latitude: v.latitude ?? v.lat ?? null,
    longitude: v.longitude ?? v.lng ?? null,
    price_level: v.price_level ?? 2,
    votes_for: v.votes_for ?? [],
    votes_against: v.votes_against ?? [],
    proposed_by: v.proposed_by ?? "",
  };
}
```

### `normalizeConsensus`
```ts
function normalizeConsensus(c: any): any {
  if (!c) return null;
  const cs = c.contribution_summary ?? {};
  const normalized: Record<string, string> = Array.isArray(cs)
    ? Object.fromEntries(cs.map((item: any) => [item.proxy ?? item.name ?? "?", item.contribution ?? item.summary ?? ""]))
    : cs;
  return {
    ...c,
    achieved: c.achieved ?? false,
    alignment_percentage: c.alignment_percentage ?? c.alignment_score ?? 0,
    meeting_time: c.meeting_time ?? c.time ?? "",
    meeting_format: c.meeting_format ?? c.format ?? "either",
    fairness_score: typeof c.fairness_score === "number" ? c.fairness_score : 75,
    contribution_summary: normalized,
    badges_awarded: c.badges_awarded ?? [],
    venue: c.venue ? { ...c.venue, venue_id: c.venue.venue_id || c.venue.id || "", venue_type: c.venue.venue_type ?? c.venue.type ?? "", price_level: c.venue.price_level ?? 2, votes_for: c.venue.votes_for ?? [], votes_against: c.venue.votes_against ?? [], proposed_by: c.venue.proposed_by ?? "" } : null,
  };
}
```

### `normalizeRoom`
```ts
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
    fairness_metrics: raw.fairness_metrics ?? raw.fairness ?? { group_alignment: 0, travel_fairness: 0, budget_harmony: 0, compromise_balance: 0 },
    consensus: raw.consensus ? normalizeConsensus(raw.consensus) : null,
    venue_proposals: (raw.venue_proposals ?? raw.venues ?? []).map(normalizeVenue),
    max_users: raw.max_users ?? 6,
  };
}
```
