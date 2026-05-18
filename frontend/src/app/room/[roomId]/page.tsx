"use client";

import { use, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";
import { useRoomStore } from "@/stores/roomStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getRoom } from "@/lib/api";
import { HumanControls } from "@/components/negotiation/HumanControls";
import { LiveFeed } from "@/components/negotiation/LiveFeed";
import { ConsensusMetrics } from "@/components/negotiation/ConsensusMetrics";
import { ConsensusCard } from "@/components/negotiation/ConsensusCard";
import type { RoomState } from "@/types";
import { RoomStatus } from "@/types";
import Link from "next/link";

// Lazy load the graph (heavy React Flow import)
const NegotiationGraph = dynamic(
  () =>
    import("@/components/negotiation/NegotiationGraph").then(
      (m) => m.NegotiationGraph
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0d0d14]">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            className="w-10 h-10 border-2 border-blue-500/40 border-t-blue-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <span className="text-slate-500 text-sm">Loading graph...</span>
        </div>
      </div>
    ),
  }
);

const DEFAULT_FAIRNESS = {
  group_alignment: 0,
  travel_fairness: 0,
  budget_harmony: 0,
  compromise_balance: 0,
};

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();

  const room = useRoomStore((s) => s.room);
  const currentUser = useRoomStore((s) => s.currentUser);
  const setRoom = useRoomStore((s) => s.setRoom);
  const participantVersion = useRoomStore((s) => s.participantVersion);

  const [isLoading, setIsLoading] = useState(!room);
  const [isConsensusDismissed, setIsConsensusDismissed] = useState(false);

  // Connect WebSocket
  const { isConnected: wsConnected } = useWebSocket(roomId);

  // Fetch room data on mount and whenever participants join/leave
  useEffect(() => {
    getRoom(roomId)
      .then((data) => {
        setRoom(data);
        setIsLoading(false);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Room not found");
        router.push("/");
      });
  }, [roomId, participantVersion, setRoom, router]); // participantVersion triggers refetch on join/leave

  const handleRoomUpdate = (updatedRoom: RoomState) => {
    setRoom(updatedRoom);
  };

  if (isLoading || !room) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-12 h-12 border-2 border-blue-500/40 border-t-blue-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-slate-400 text-sm">Loading room...</p>
        </div>
      </div>
    );
  }

  const fairnessMetrics = room.fairness_metrics ?? DEFAULT_FAIRNESS;
  const showConsensus =
    room.status === RoomStatus.CONSENSUS &&
    Boolean(room.consensus?.achieved) &&
    !isConsensusDismissed;

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-[#0d0d14] flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors">
            <span className="text-lg">🤖</span>
            <span className="font-semibold text-white text-sm">Proxy</span>
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{room.room_name}</span>
            <span className="text-xs text-slate-600">#{roomId.slice(0, 8)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                wsConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`}
            />
            <span className="text-xs text-slate-500">
              {wsConnected ? "Connected" : "Reconnecting..."}
            </span>
          </div>

          {/* Room status badge */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              room.status === RoomStatus.NEGOTIATING
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : room.status === RoomStatus.CONSENSUS
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-white/5 text-slate-400"
            }`}
          >
            {room.status === RoomStatus.NEGOTIATING && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse mr-1.5" />
            )}
            {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
          </div>

          {/* Map link */}
          <Link
            href={`/room/${roomId}/map`}
            className="px-3 py-1.5 text-xs text-slate-400 border border-white/8 rounded-lg hover:text-white hover:border-white/20 transition-all"
          >
            🗺️ Map
          </Link>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Human Controls */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-72 flex-shrink-0 border-r border-white/8 bg-[#0d0d14] flex flex-col overflow-hidden"
        >
          <HumanControls
            room={room}
            currentUser={currentUser}
            onRoomUpdate={handleRoomUpdate}
          />
        </motion.aside>

        {/* Center — Negotiation Graph */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            <NegotiationGraph
              proxies={room.proxies}
              messages={room.messages}
            />

            {/* Overlay when waiting */}
            <AnimatePresence>
              {room.status === RoomStatus.WAITING && room.users.length < 2 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none"
                >
                  <div className="px-5 py-3 rounded-xl bg-[#1a1a2e]/90 border border-white/10 text-center backdrop-blur-sm">
                    <p className="text-sm text-slate-400">
                      Share the room link to invite more participants
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {room.users.length}/2 minimum participants joined
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Right panel — Live Feed */}
        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-80 flex-shrink-0 border-l border-white/8 bg-[#0d0d14] flex flex-col overflow-hidden"
        >
          <LiveFeed messages={room.messages} proxies={room.proxies} />
        </motion.aside>
      </div>

      {/* Bottom bar — Consensus Metrics */}
      <ConsensusMetrics metrics={fairnessMetrics} />

      {/* Consensus card modal */}
      <AnimatePresence>
        {showConsensus && room.consensus && (
          <ConsensusCard
            result={room.consensus}
            onClose={() => setIsConsensusDismissed(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
