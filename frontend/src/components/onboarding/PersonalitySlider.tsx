"use client";

import { motion } from "framer-motion";

interface PersonalitySliderProps {
  leftLabel: string;
  rightLabel: string;
  value: number; // 0-100
  onChange: (value: number) => void;
  color?: string;
}

export function PersonalitySlider({
  leftLabel,
  rightLabel,
  value,
  onChange,
  color = "#60a5fa",
}: PersonalitySliderProps) {
  const percentage = value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium">
        <span
          className="text-slate-400"
          style={{ opacity: value < 30 ? 1 : 0.5 }}
        >
          {leftLabel}
        </span>
        <span
          className="text-slate-400"
          style={{ opacity: value > 70 ? 1 : 0.5 }}
        >
          {rightLabel}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-1 bg-[#2d2d3f] rounded-full" />
        {/* Filled track */}
        <motion.div
          className="absolute h-1 rounded-full"
          style={{ backgroundColor: color, opacity: 0.6 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
        {/* Range input */}
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="neon-slider absolute w-full cursor-pointer"
          style={
            {
              "--thumb-color": color,
            } as React.CSSProperties
          }
        />
      </div>
      <div className="flex justify-center">
        <span className="text-xs font-mono text-slate-600">
          {value < 20
            ? `Strong ${leftLabel}`
            : value < 40
            ? `Lean ${leftLabel}`
            : value < 60
            ? "Balanced"
            : value < 80
            ? `Lean ${rightLabel}`
            : `Strong ${rightLabel}`}
        </span>
      </div>
    </div>
  );
}
