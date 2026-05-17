"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ConsensusResult } from "@/types";
import { BadgeDisplay } from "@/components/badges/BadgeDisplay";

interface ConsensusCardProps {
  result: ConsensusResult;
  onClose: () => void;
}

export function ConsensusCard({ result, onClose }: ConsensusCardProps) {
  const alignmentPct = Math.round(result.alignment_percentage);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Card */}
        <motion.div
          className="relative w-full max-w-lg rounded-2xl bg-[#12121a] border overflow-hidden"
          style={{
            borderColor: "rgba(52, 211, 153, 0.4)",
            boxShadow:
              "0 0 40px rgba(52, 211, 153, 0.15), 0 0 80px rgba(52, 211, 153, 0.08)",
          }}
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 10 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top glow strip */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-blue-400 to-emerald-400" />

          {/* Header */}
          <div className="px-6 pt-6 pb-4 text-center">
            <motion.div
              className="text-5xl mb-3"
              animate={{ rotate: [0, 10, -10, 10, 0] }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              ✨
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Consensus Achieved!
            </h2>
            <div className="flex items-center justify-center gap-2">
              <div
                className="text-3xl font-black font-mono text-emerald-400"
                style={{
                  textShadow:
                    "0 0 16px rgba(52,211,153,0.5), 0 0 32px rgba(52,211,153,0.2)",
                }}
              >
                {alignmentPct}%
              </div>
              <span className="text-slate-400 text-sm">group alignment</span>
            </div>
          </div>

          {/* Venue info */}
          {result.venue && (
            <div className="mx-6 mb-4 p-4 rounded-xl bg-[#1a1a2e] border border-emerald-500/20">
              <div className="flex items-start gap-3">
                <div className="text-2xl">📍</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white">{result.venue.name}</div>
                  <div className="text-sm text-slate-400 truncate">
                    {result.venue.address}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-slate-500">
                      {"$".repeat(result.venue.price_level)}
                    </span>
                    {result.venue.rating && (
                      <span className="text-xs text-amber-400">
                        ★ {result.venue.rating.toFixed(1)}
                      </span>
                    )}
                    <span className="text-xs text-blue-300 capitalize">
                      {result.venue.venue_type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Meeting details */}
          <div className="mx-6 mb-4 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#1a1a2e] border border-white/8">
              <div className="text-xs text-slate-500 mb-1">Time</div>
              <div className="text-sm font-medium text-white">
                {result.meeting_time || "TBD"}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#1a1a2e] border border-white/8">
              <div className="text-xs text-slate-500 mb-1">Format</div>
              <div className="text-sm font-medium text-white capitalize">
                {result.meeting_format}
              </div>
            </div>
          </div>

          {/* Backup plan */}
          {result.backup_plan && (
            <div className="mx-6 mb-4 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <div className="text-xs text-amber-400 font-medium mb-1">Backup Plan</div>
              <div className="text-sm text-slate-400">{result.backup_plan}</div>
            </div>
          )}

          {/* Fairness score */}
          <div className="mx-6 mb-4 flex items-center gap-3 p-3 rounded-xl bg-[#1a1a2e] border border-white/8">
            <div className="text-2xl">⚖️</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Fairness Score</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {Math.round(result.fairness_score)}%
                </span>
              </div>
              <div className="h-1.5 bg-[#2d2d3f] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${result.fairness_score}%` }}
                  transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>

          {/* Contribution summary */}
          {Object.keys(result.contribution_summary).length > 0 && (
            <div className="mx-6 mb-4">
              <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                Contribution Summary
              </div>
              <div className="space-y-1.5">
                {Object.entries(result.contribution_summary).map(([name, contribution]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-[#1a1a2e]"
                  >
                    <span className="text-slate-400">{name}</span>
                    <span className="text-slate-300">{contribution}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Badges */}
          {result.badges_awarded.length > 0 && (
            <div className="mx-6 mb-4">
              <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                Badges Awarded
              </div>
              <BadgeDisplay badges={result.badges_awarded} animated />
            </div>
          )}

          {/* Close button */}
          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl font-semibold text-sm text-white bg-emerald-500 hover:bg-emerald-400 transition-all glow-green"
            >
              Perfect! 🎉
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
