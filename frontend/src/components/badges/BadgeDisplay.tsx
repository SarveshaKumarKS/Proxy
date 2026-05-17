"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { BadgeAward } from "@/types";

const BADGE_GLOW_COLORS: Record<string, string> = {
  "Consensus Hero": "#fbbf24",
  "Bridge Builder": "#60a5fa",
  "Fairness Guardian": "#34d399",
  "Chaos Stabilizer": "#f87171",
  "Last Minute Saver": "#fb923c",
  "Flexible Legend": "#a78bfa",
};

const BADGE_DESCRIPTIONS: Record<string, string> = {
  "Consensus Hero": "Drove the group to final agreement",
  "Bridge Builder": "Resolved the most conflicts",
  "Fairness Guardian": "Ensured equitable outcomes for all",
  "Chaos Stabilizer": "Kept negotiations on track",
  "Last Minute Saver": "Broke the deadlock at the critical moment",
  "Flexible Legend": "Made the most compromises gracefully",
};

interface BadgeDisplayProps {
  badges: BadgeAward[];
  animated?: boolean;
}

export function BadgeDisplay({ badges, animated = false }: BadgeDisplayProps) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence>
        {badges.map((badge, i) => {
          const glowColor = BADGE_GLOW_COLORS[badge.badge_name] ?? "#60a5fa";
          const description =
            badge.description || BADGE_DESCRIPTIONS[badge.badge_name] || "";

          return (
            <motion.div
              key={badge.badge_id}
              initial={animated ? { scale: 0, opacity: 0 } : undefined}
              animate={animated ? { scale: 1, opacity: 1 } : undefined}
              transition={
                animated
                  ? {
                      type: "spring",
                      stiffness: 300,
                      damping: 20,
                      delay: i * 0.15,
                    }
                  : undefined
              }
              className="relative group"
            >
              <div
                className="px-3 py-2 rounded-xl border flex items-center gap-2 cursor-default"
                style={{
                  borderColor: `${glowColor}40`,
                  backgroundColor: `${glowColor}10`,
                  boxShadow: animated
                    ? `0 0 12px ${glowColor}20`
                    : undefined,
                }}
              >
                <span className="text-xl">{badge.badge_emoji}</span>
                <div>
                  <div className="text-xs font-semibold" style={{ color: glowColor }}>
                    {badge.badge_name}
                  </div>
                  <div className="text-xs text-slate-500 truncate max-w-[120px]">
                    {badge.awarded_to_name}
                  </div>
                </div>
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/10 text-xs text-slate-300 w-40 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10 shadow-lg">
                {description}
              </div>

              {/* Glow pulse for new badges */}
              {animated && (
                <motion.div
                  className="absolute inset-0 rounded-xl"
                  style={{ backgroundColor: glowColor }}
                  animate={{ opacity: [0.1, 0.3, 0] }}
                  transition={{ duration: 1, delay: i * 0.15 + 0.3 }}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// Standalone badge card for detailed display
interface BadgeCardProps {
  badgeName: string;
  emoji: string;
  description?: string;
  awardedTo?: string;
  isNew?: boolean;
}

export function BadgeCard({
  badgeName,
  emoji,
  description,
  awardedTo,
  isNew = false,
}: BadgeCardProps) {
  const glowColor = BADGE_GLOW_COLORS[badgeName] ?? "#60a5fa";
  const desc = description || BADGE_DESCRIPTIONS[badgeName] || "";

  return (
    <motion.div
      className="p-4 rounded-2xl border flex items-center gap-4"
      style={{
        borderColor: `${glowColor}30`,
        backgroundColor: `${glowColor}08`,
        boxShadow: isNew ? `0 0 20px ${glowColor}20` : undefined,
      }}
      animate={
        isNew
          ? { boxShadow: [`0 0 0px ${glowColor}00`, `0 0 24px ${glowColor}30`, `0 0 12px ${glowColor}15`] }
          : undefined
      }
      transition={isNew ? { duration: 1.5, times: [0, 0.5, 1] } : undefined}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
        style={{
          backgroundColor: `${glowColor}15`,
          border: `1.5px solid ${glowColor}40`,
        }}
      >
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm" style={{ color: glowColor }}>
          {badgeName}
        </div>
        {desc && <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</div>}
        {awardedTo && (
          <div className="text-xs text-slate-600 mt-1">Awarded to {awardedTo}</div>
        )}
      </div>
    </motion.div>
  );
}
