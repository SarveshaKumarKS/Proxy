import { create } from "zustand";
import type {
  ConsensusResult,
  FairnessMetrics,
  NegotiationMessage,
  RoomState,
  UserProfile,
  WebSocketMessage,
} from "@/types";
import { MessageType, RoomStatus } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeConsensus(c: any): any {
  if (!c) return null;
  const contributionSummary = c.contribution_summary ?? {};
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
    location: raw.location ?? null,
    status: raw.status ?? "waiting",
    created_at: raw.created_at ?? new Date().toISOString(),
    host_id: raw.host_id ?? "",
    users: rawUsers.map(normalizeUser),
    proxies: rawProxies.map(normalizeProxy),
    messages: raw.messages ?? [],
    fairness_metrics: raw.fairness_metrics ?? raw.fairness ?? {
      group_alignment: 0, travel_fairness: 0, budget_harmony: 0, compromise_balance: 0,
    },
    consensus: raw.consensus ? normalizeConsensus(raw.consensus) : null,
    venue_proposals: raw.venue_proposals ?? raw.venues ?? [],
    max_users: raw.max_users ?? 6,
  };
}

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ??
  API_BASE.replace(/^https?:\/\//, (protocol) =>
    protocol === "https://" ? "wss://" : "ws://"
  );

interface RoomStore {
  room: RoomState | null;
  currentUser: UserProfile | null;
  isConnected: boolean;
  ws: WebSocket | null;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  participantVersion: number; // increments when someone joins/leaves

  setRoom: (room: RoomState) => void;
  setCurrentUser: (user: UserProfile) => void;
  connectWS: (roomId: string) => void;
  disconnectWS: () => void;
  sendWSMessage: (type: string, data: unknown) => void;
  addMessage: (msg: NegotiationMessage) => void;
  updateFairness: (metrics: FairnessMetrics) => void;
  setConsensus: (result: ConsensusResult) => void;
  setProxyThinking: (proxyId: string, isThinking: boolean) => void;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  room: null,
  currentUser: null,
  isConnected: false,
  ws: null,
  reconnectAttempts: 0,
  reconnectTimer: null,
  participantVersion: 0,

  setRoom: (room) => set({ room }),

  setCurrentUser: (user) => set({ currentUser: user }),

  connectWS: (roomId: string) => {
    const { ws, disconnectWS } = get();
    if (ws) {
      disconnectWS();
    }

    const wsUrl = `${WS_BASE}/ws/${roomId}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      console.error("Failed to create WebSocket:", wsUrl);
      return;
    }

    socket.onopen = () => {
      set({ isConnected: true, reconnectAttempts: 0 });
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        const msg: WebSocketMessage = JSON.parse(event.data as string);
        const { room } = get();

        switch (msg.type) {
          case "room_state": {
            // Full room object from backend — normalize field names
            set({ room: normalizeRoom(msg.data) });
            break;
          }
          case "room_update": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = msg.data as any;
            if (!d) break;
            if (d.id || d.room_id) {
              // Full room payload — replace entirely
              set({ room: normalizeRoom(d) });
            } else {
              // Partial update — merge known fields into existing room
              const { room: cur } = get();
              if (cur) {
                const patch: Partial<RoomState> = {};
                if (d.status) patch.status = d.status;
                if (d.proxies) {
                  patch.proxies = Array.isArray(d.proxies)
                    ? d.proxies
                    : Object.values(d.proxies as Record<string, unknown>);
                }
                if (d.fairness) patch.fairness_metrics = d.fairness as FairnessMetrics;
                if (d.fairness_metrics) patch.fairness_metrics = d.fairness_metrics as FairnessMetrics;
                if (d.messages) patch.messages = d.messages;
                if (typeof d.message === "string") {
                  const updateMessage: NegotiationMessage = {
                    message_id: `update-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    proxy_id: "system",
                    proxy_name: "System",
                    human_name: "",
                    avatar_emoji: "↻",
                    content: d.message,
                    message_type: MessageType.INFO,
                    timestamp: msg.timestamp ?? new Date().toISOString(),
                  };
                  patch.messages = [...cur.messages, updateMessage];
                }
                if (Object.keys(patch).length > 0) {
                  set({ room: { ...cur, ...patch } });
                }
              }
            }
            break;
          }
          case "participant_connected":
          case "participant_disconnected": {
            set((s) => ({ participantVersion: s.participantVersion + 1 }));
            break;
          }
          case "proxy_message":
          case "negotiation_message": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const raw = msg.data as any;
            // Backend wraps in {message: {...}} for negotiation_message
            const msgObj = raw?.message ?? raw;
            // Normalize backend field names to frontend NegotiationMessage shape
            const normalized: NegotiationMessage = {
              message_id: msgObj.message_id ?? msgObj.id ?? String(Date.now()),
              proxy_id: msgObj.proxy_id ?? msgObj.user_id ?? "",
              proxy_name: msgObj.proxy_name ?? "System",
              human_name: msgObj.human_name ?? "",
              avatar_emoji: msgObj.avatar_emoji ?? msgObj.avatar ?? "🤖",
              content: msgObj.content ?? msgObj.message ?? "",
              message_type: msgObj.message_type ?? "info",
              timestamp: msgObj.timestamp ?? new Date().toISOString(),
            };
            const cur = get().room;
            if (cur) {
              set({ room: { ...cur, messages: [...cur.messages, normalized] } });
            }
            break;
          }
          case "chat": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = msg.data as any;
            const normalized: NegotiationMessage = {
              message_id: d?.message_id ?? `human-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              proxy_id: "human",
              proxy_name: d?.user_name ?? "Human",
              human_name: d?.user_name ?? "",
              avatar_emoji: d?.avatar_emoji ?? "💬",
              content: d?.message ?? "",
              message_type: MessageType.INFO,
              timestamp: d?.timestamp ?? msg.timestamp ?? new Date().toISOString(),
            };
            const cur = get().room;
            if (cur && normalized.content) {
              set({ room: { ...cur, messages: [...cur.messages, normalized] } });
            }
            break;
          }
          case "human_checkpoint": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = msg.data as any;
            const normalized: NegotiationMessage = {
              message_id: d?.message_id ?? `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              proxy_id: "system",
              proxy_name: "Checkpoint",
              human_name: "",
              avatar_emoji: "👀",
              content: d?.message ?? "Humans can weigh in now before the agents settle on a final compromise.",
              message_type: MessageType.INFO,
              timestamp: d?.timestamp ?? msg.timestamp ?? new Date().toISOString(),
            };
            const cur = get().room;
            if (cur) {
              set({ room: { ...cur, messages: [...cur.messages, normalized] } });
            }
            break;
          }
          case "fairness_update": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = msg.data as any;
            // Backend wraps metrics in {fairness: {...}}
            const metrics = (d?.fairness ?? d) as FairnessMetrics;
            get().updateFairness(metrics);
            break;
          }
          case "consensus_achieved":
          case "consensus_reached": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = msg.data as any;
            const raw = d?.consensus ?? d;
            get().setConsensus(normalizeConsensus(raw) as ConsensusResult);
            break;
          }
          case "proxy_thinking": {
            const { proxyId, isThinking } = msg.data as {
              proxyId: string;
              isThinking: boolean;
            };
            get().setProxyThinking(proxyId, isThinking);
            break;
          }
          case "user_joined":
          case "user_left":
          case "negotiation_started":
          case "venue_proposed": {
            if (msg.data && typeof msg.data === "object" && "room_id" in (msg.data as object)) {
              set({ room: msg.data as RoomState });
            }
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error("WS message parse error:", err);
      }
    };

    socket.onclose = () => {
      set({ isConnected: false, ws: null });
      const { reconnectAttempts } = get();
      if (reconnectAttempts < 5) {
        const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
        const timer = setTimeout(() => {
          set((s) => ({ reconnectAttempts: s.reconnectAttempts + 1 }));
          get().connectWS(roomId);
        }, delay);
        set({ reconnectTimer: timer });
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    set({ ws: socket });
  },

  disconnectWS: () => {
    const { ws, reconnectTimer } = get();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    if (ws) {
      ws.onclose = null; // prevent reconnect logic
      ws.close();
    }
    set({ ws: null, isConnected: false, reconnectAttempts: 0, reconnectTimer: null });
  },

  sendWSMessage: (type: string, data: unknown) => {
    const { ws, isConnected } = get();
    if (ws && isConnected) {
      ws.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    }
  },

  addMessage: (msg: NegotiationMessage) => {
    const { room } = get();
    if (room) {
      set({
        room: {
          ...room,
          messages: [...room.messages, msg],
        },
      });
    }
  },

  updateFairness: (metrics: FairnessMetrics) => {
    const { room } = get();
    if (room) {
      set({
        room: {
          ...room,
          fairness_metrics: metrics,
        },
      });
    }
  },

  setConsensus: (result: ConsensusResult) => {
    const { room } = get();
    if (room) {
      set({
        room: {
          ...room,
          consensus: result,
          status: result.achieved ? RoomStatus.CONSENSUS : room.status,
        },
      });
    }
  },

  setProxyThinking: (proxyId: string, isThinking: boolean) => {
    const { room } = get();
    if (room) {
      set({
        room: {
          ...room,
          proxies: room.proxies.map((p) =>
            p.proxy_id === proxyId ? { ...p, is_thinking: isThinking } : p
          ),
        },
      });
    }
  },
}));
