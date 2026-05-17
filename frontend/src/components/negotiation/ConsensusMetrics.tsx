"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import type { FairnessMetrics } from "@/types";

interface MetricCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  glowClass: string;
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (v) => Math.round(v));
  const prevValue = useRef(0);

  useEffect(() => {
    prevValue.current = value;
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}

function MetricCard({ label, value, icon, color, glowClass }: MetricCardProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`flex-1 min-w-0 p-4 rounded-xl bg-[#12121a] border border-white/8 hover:border-opacity-30 transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-xs font-medium text-slate-400 truncate">{label}</span>
        </div>
        <div className="text-sm font-bold font-mono" style={{ color }}>
          <AnimatedNumber value={clampedValue} />%
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-[#2d2d3f] overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: "0%" }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100, damping: 25 }}
        />
        {/* Shimmer effect on high values */}
        {clampedValue > 70 && (
          <motion.div
            className="absolute inset-y-0 w-8 rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
              left: `${clampedValue - 10}%`,
            }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      {/* Status label */}
      <div className="mt-2 text-xs" style={{ color: `${color}80` }}>
        {clampedValue >= 80
          ? "Excellent"
          : clampedValue >= 60
          ? "Good"
          : clampedValue >= 40
          ? "Moderate"
          : clampedValue >= 20
          ? "Low"
          : "Starting..."}
      </div>
    </div>
  );
}

interface ConsensusMetricsProps {
  metrics: FairnessMetrics;
}

export function ConsensusMetrics({ metrics }: ConsensusMetricsProps) {
  const metricCards: MetricCardProps[] = [
    {
      label: "Group Alignment",
      value: metrics.group_alignment,
      icon: "🎯",
      color: "#60a5fa",
      glowClass: "glow-blue",
    },
    {
      label: "Travel Fairness",
      value: metrics.travel_fairness,
      icon: "🗺️",
      color: "#34d399",
      glowClass: "glow-green",
    },
    {
      label: "Budget Harmony",
      value: metrics.budget_harmony,
      icon: "💰",
      color: "#fbbf24",
      glowClass: "glow-amber",
    },
    {
      label: "Compromise Balance",
      value: metrics.compromise_balance,
      icon: "⚖️",
      color: "#a78bfa",
      glowClass: "glow-purple",
    },
  ];

  const overall = Math.round(
    (metrics.group_alignment +
      metrics.travel_fairness +
      metrics.budget_harmony +
      metrics.compromise_balance) /
      4
  );

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-white/8 bg-[#0d0d14]">
      {/* Overall score */}
      <div className="flex items-center gap-2 pr-4 border-r border-white/8 flex-shrink-0">
        <div className="relative w-10 h-10">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#2d2d3f"
              strokeWidth="3"
            />
            <motion.circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 15}`}
              animate={{
                strokeDashoffset: `${2 * Math.PI * 15 * (1 - overall / 100)}`,
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono text-blue-400">
            <AnimatedNumber value={overall} />
          </div>
        </div>
        <div className="text-xs text-slate-500">Overall</div>
      </div>

      {/* Individual metrics */}
      <div className="flex-1 flex gap-3">
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
}
