"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { ProxyAgent, RoomState, UserProfile } from "@/types";
import { BudgetLevel, RoomStatus } from "@/types";
import { relaxConstraint, startNegotiation, vetoProposal } from "@/lib/api";
import { getProxyColor, budgetLevelLabel } from "@/lib/utils";
import { PersonalitySlider } from "@/components/onboarding/PersonalitySlider";

interface HumanControlsProps {
  room: RoomState;
  currentUser: UserProfile | null;
  onRoomUpdate: (room: RoomState) => void;
}

function AccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-300 hover:text-white transition-colors bg-[#12121a] hover:bg-[#1a1a2e]"
      >
        {title}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-600 text-xs"
        >
          ▼
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 bg-[#0d0d14] border-t border-white/5 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HumanControls({
  room,
  currentUser,
  onRoomUpdate,
}: HumanControlsProps) {
  const [travelRadius, setTravelRadius] = useState(50);
  const [selectedBudget, setSelectedBudget] = useState<BudgetLevel>(
    currentUser?.preferences.budget ?? BudgetLevel.MEDIUM
  );
  const [vetoReason, setVetoReason] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isVetoing, setIsVetoing] = useState(false);

  const myProxy: ProxyAgent | undefined = room.proxies.find(
    (p) => p.user_id === currentUser?.user_id
  );
  const myProxyColor = myProxy
    ? getProxyColor(myProxy.color_index ?? 0)
    : "#60a5fa";

  const canStart =
    room.status === RoomStatus.WAITING && room.users.length >= 2;

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await startNegotiation(room.room_id);
      toast.success("Negotiation started!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setIsStarting(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!myProxy) return;
    setIsApplying(true);
    try {
      await relaxConstraint(room.room_id, {
        constraint_type: "budget_travel",
        new_value: { budget: selectedBudget, travel_radius: travelRadius },
        proxy_id: myProxy.proxy_id,
      });
      toast.success("Constraints updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsApplying(false);
    }
  };

  const handleVeto = async () => {
    if (!myProxy || !vetoReason.trim()) {
      toast.error("Please enter a veto reason");
      return;
    }
    const lastProposal = room.venue_proposals[room.venue_proposals.length - 1];
    if (!lastProposal) {
      toast.error("No active proposal to veto");
      return;
    }
    setIsVetoing(true);
    try {
      await vetoProposal(room.room_id, {
        proxy_id: myProxy.proxy_id,
        venue_id: lastProposal?.venue_id,
        reason: vetoReason.trim(),
      });
      setVetoReason("");
      toast.success("Veto submitted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to veto");
    } finally {
      setIsVetoing(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/8 flex-shrink-0">
        <h2 className="text-sm font-semibold text-white">Human Controls</h2>
        <p className="text-xs text-slate-600 mt-0.5">Override your proxy anytime</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* My proxy card */}
        {myProxy ? (
          <div
            className="p-3 rounded-xl border flex items-center gap-3"
            style={{
              borderColor: `${myProxyColor}30`,
              backgroundColor: `${myProxyColor}08`,
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl border-2 flex-shrink-0"
              style={{
                borderColor: myProxyColor,
                backgroundColor: `${myProxyColor}15`,
              }}
            >
              {myProxy.avatar_emoji}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: myProxyColor }}>
                {myProxy.proxy_name}
              </div>
              <div className="text-xs text-slate-500">You: {myProxy.human_name}</div>
              {myProxy.is_thinking && (
                <div className="flex items-center gap-1 mt-1">
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="text-xs text-slate-600">thinking</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-600">
            Not in negotiation yet
          </div>
        )}

        {/* Room status */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#12121a] border border-white/8">
          <div
            className={`w-2 h-2 rounded-full ${
              room.status === RoomStatus.NEGOTIATING
                ? "bg-amber-400 animate-pulse"
                : room.status === RoomStatus.CONSENSUS
                ? "bg-emerald-400"
                : "bg-slate-600"
            }`}
          />
          <span className="text-xs text-slate-400 capitalize">{room.status}</span>
          <span className="ml-auto text-xs text-slate-600">
            {room.users.length}/{room.max_users ?? "∞"} joined
          </span>
        </div>

        {/* Start negotiation */}
        {room.status === RoomStatus.WAITING && (
          <button
            onClick={handleStart}
            disabled={!canStart || isStarting}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-blue flex items-center justify-center gap-2"
          >
            {isStarting ? (
              <>
                <motion.div
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                Starting...
              </>
            ) : (
              <>⚡ Start Negotiation</>
            )}
          </button>
        )}
        {!canStart && room.status === RoomStatus.WAITING && (
          <p className="text-xs text-slate-600 text-center -mt-2">
            Need at least 2 participants
          </p>
        )}

        {/* Modify constraints */}
        {myProxy && (
          <AccordionSection title="Modify Constraints" defaultOpen>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-2">
                  Travel Radius
                </label>
                <PersonalitySlider
                  leftLabel="Close"
                  rightLabel="Far"
                  value={travelRadius}
                  onChange={setTravelRadius}
                  color="#60a5fa"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-2">Budget</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.values(BudgetLevel).map((level) => (
                    <button
                      key={level}
                      onClick={() => setSelectedBudget(level)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all border ${
                        selectedBudget === level
                          ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                          : "border-white/8 bg-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {budgetLevelLabel(level)}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleApplyChanges}
                disabled={isApplying}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-blue-300 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isApplying ? "Applying..." : "Apply Changes"}
              </button>
            </div>
          </AccordionSection>
        )}

        {/* Veto section */}
        {myProxy && room.status === RoomStatus.NEGOTIATING && (
          <AccordionSection title="Veto Proposal">
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Veto the current proposal and explain why.
              </p>
              <textarea
                value={vetoReason}
                onChange={(e) => setVetoReason(e.target.value)}
                placeholder="e.g. Too far, not enough parking..."
                rows={3}
                className="w-full px-3 py-2.5 bg-[#12121a] border border-white/10 rounded-xl text-white text-xs placeholder-slate-700 focus:outline-none focus:border-red-500/50 transition-all resize-none"
              />
              <button
                onClick={handleVeto}
                disabled={isVetoing || !vetoReason.trim()}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-red"
              >
                {isVetoing ? "Vetoing..." : "🚫 Veto This Proposal"}
              </button>
            </div>
          </AccordionSection>
        )}

        {/* Participants */}
        <AccordionSection title={`Participants (${room.users.length})`}>
          <div className="space-y-2">
            {room.users.length === 0 ? (
              <p className="text-xs text-slate-600 text-center">No participants yet</p>
            ) : room.proxies.length > 0 ? (
              room.proxies.map((proxy, i) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const raw = proxy as any;
                const proxyId = raw.proxy_id ?? raw.id ?? String(i);
                const color = getProxyColor(raw.color_index ?? i);
                const emoji = raw.avatar_emoji ?? raw.avatar ?? "🤖";
                return (
                  <div key={proxyId} className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm border flex-shrink-0"
                      style={{ borderColor: `${color}50`, backgroundColor: `${color}15` }}
                    >
                      {emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium" style={{ color }}>{proxy.proxy_name}</div>
                      <div className="text-xs text-slate-600 truncate">{proxy.human_name}</div>
                    </div>
                    {proxy.user_id === currentUser?.user_id && (
                      <span className="text-xs text-slate-600 bg-[#1a1a2e] px-1.5 py-0.5 rounded">you</span>
                    )}
                  </div>
                );
              })
            ) : (
              room.users.map((user, i) => {
                const colors = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c"];
                const color = colors[i % colors.length];
                return (
                  <div key={user.user_id} className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm border flex-shrink-0"
                      style={{ borderColor: `${color}50`, backgroundColor: `${color}15` }}
                    >
                      {user.avatar_emoji ?? "🤖"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate" style={{ color }}>{user.name}</div>
                      <div className="text-xs text-slate-600">Waiting for proxy...</div>
                    </div>
                    {user.user_id === currentUser?.user_id && (
                      <span className="text-xs text-slate-600 bg-[#1a1a2e] px-1.5 py-0.5 rounded">you</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </AccordionSection>

        {/* Share link */}
        <div className="p-3 rounded-xl bg-[#12121a] border border-white/8">
          <p className="text-xs text-slate-500 mb-2">Invite others</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={typeof window !== "undefined" ? `${window.location.origin}/room/${room.room_id}/join` : ""}
              className="flex-1 text-xs text-slate-400 bg-[#0a0a0f] border border-white/8 rounded-lg px-2.5 py-2 truncate font-mono"
            />
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/room/${room.room_id}/join`
                  );
                  toast.success("Link copied!");
                }
              }}
              className="px-3 py-2 text-xs font-medium text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/10 transition-all flex-shrink-0"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
