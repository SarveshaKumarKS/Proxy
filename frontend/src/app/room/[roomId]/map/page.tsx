"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRoomStore } from "@/stores/roomStore";
import { getRoom, getVenues } from "@/lib/api";
import type { VenueProposal } from "@/types";
import "mapbox-gl/dist/mapbox-gl.css";

// Lazy load FairnessMap (uses browser APIs)
const FairnessMap = dynamic(
  () =>
    import("@/components/map/FairnessMap").then((m) => m.FairnessMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0d0d14] rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            className="w-10 h-10 border-2 border-blue-500/40 border-t-blue-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <span className="text-slate-500 text-sm">Loading map...</span>
        </div>
      </div>
    ),
  }
);

export default function MapPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);
  const [venues, setVenues] = useState<VenueProposal[]>([]);
  const [selectedVenueIndex, setSelectedVenueIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomData, venueData] = await Promise.all([
          room?.room_id === roomId ? Promise.resolve(room) : getRoom(roomId),
          getVenues(roomId).catch(() => []),
        ]);
        setRoom(roomData);
        setVenues(venueData);
      } catch (err) {
        console.error("Failed to load map data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [roomId, room, setRoom]);

  const currentVenue = venues[selectedVenueIndex] ?? room?.venue_proposals?.[0] ?? null;

  // Stable random offsets per user so travelData doesn't recreate the map on every render
  const userCount = room?.users?.length ?? 0;
  const stableOffsets = useRef<number[][]>([]);
  if (stableOffsets.current.length !== userCount) {
    stableOffsets.current = Array.from({ length: userCount }, () => [
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05,
      15 + Math.round(Math.random() * 25),
    ]);
  }

  const travelData = useMemo(() => {
    const venueLat = currentVenue?.latitude ?? (currentVenue as any)?.lat; // eslint-disable-line @typescript-eslint/no-explicit-any
    const venueLng = currentVenue?.longitude ?? (currentVenue as any)?.lng; // eslint-disable-line @typescript-eslint/no-explicit-any
    return (room?.users ?? []).map((user, i) => {
      const [dlat, dlng, mins] = stableOffsets.current[i] ?? [0, 0, 20];
      return {
        userId: user.user_id,
        userName: user.name,
        travelMinutes: mins,
        latitude: venueLat != null ? venueLat + dlat : 40.7484 + dlat,
        longitude: venueLng != null ? venueLng + dlng : -73.9857 + dlng,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVenue, room?.users]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#0d0d14]">
        <div className="flex items-center gap-4">
          <Link
            href={`/room/${roomId}`}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <span>←</span>
            <span>Back to Room</span>
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <div>
            <span className="text-sm font-medium text-white">
              Travel Fairness Map
            </span>
            {room && (
              <span className="text-xs text-slate-600 ml-2">
                {room.room_name}
              </span>
            )}
          </div>
        </div>

        {/* Venue selector */}
        {venues.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Venue:</span>
            <select
              value={selectedVenueIndex}
              onChange={(e) => setSelectedVenueIndex(Number(e.target.value))}
              className="px-3 py-1.5 text-xs bg-[#12121a] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
            >
              {venues.map((v, i) => (
                <option key={v.venue_id || i} value={i}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Map + sidebar layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Full map */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14]">
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  className="w-10 h-10 border-2 border-blue-500/40 border-t-blue-400 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <span className="text-slate-500 text-sm">Loading fairness data...</span>
              </div>
            </div>
          ) : (
            <FairnessMap
              users={room?.users ?? []}
              venue={currentVenue}
              travelData={travelData}
            />
          )}
        </div>

        {/* Right sidebar */}
        <aside className="w-72 flex-shrink-0 border-l border-white/8 bg-[#0d0d14] overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Fairness metrics */}
            {room?.fairness_metrics && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Fairness Metrics
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Group Alignment", value: room.fairness_metrics.group_alignment, color: "#60a5fa" },
                    { label: "Travel Fairness", value: room.fairness_metrics.travel_fairness, color: "#34d399" },
                    { label: "Budget Harmony", value: room.fairness_metrics.budget_harmony, color: "#fbbf24" },
                    { label: "Compromise Balance", value: room.fairness_metrics.compromise_balance, color: "#a78bfa" },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">{m.label}</span>
                        <span className="font-mono font-medium" style={{ color: m.color }}>
                          {Math.round(m.value)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#2d2d3f] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: m.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${m.value}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proposed venues */}
            {venues.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Proposed Venues
                </h3>
                <div className="space-y-2">
                  {venues.map((v, i) => (
                    <button
                      key={v.venue_id || i}
                      onClick={() => setSelectedVenueIndex(i)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        i === selectedVenueIndex
                          ? "border-blue-500/40 bg-blue-500/10"
                          : "border-white/8 bg-[#12121a] hover:border-white/16"
                      }`}
                    >
                      <div className="text-sm font-medium text-white">{v.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{v.address}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {v.price_level != null && (
                          <span className="text-xs text-amber-400">
                            {"$".repeat(Math.max(1, Math.min(4, v.price_level)))}
                          </span>
                        )}
                        {v.rating != null && (
                          <span className="text-xs text-emerald-400">
                            ★ {v.rating.toFixed(1)}
                          </span>
                        )}
                        {(v.votes_for ?? v.votes_against) != null && (
                          <span className="text-xs text-slate-600">
                            {(v.votes_for ?? []).length} ✓ · {(v.votes_against ?? []).length} ✗
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isLoading && venues.length === 0 && (
              <div className="text-center text-slate-600 py-8">
                <div className="text-3xl mb-2">📍</div>
                <div className="text-sm">No venues proposed yet</div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
