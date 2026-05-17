import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PROXY_COLORS = [
  "#60a5fa", // neon blue
  "#34d399", // muted green
  "#fbbf24", // amber
  "#f472b6", // pink
  "#a78bfa", // purple
  "#fb923c", // orange
];

export function getProxyColor(index: number): string {
  return PROXY_COLORS[index % PROXY_COLORS.length];
}

export function getProxyColorClass(index: number): string {
  const classes = [
    "text-blue-400",
    "text-emerald-400",
    "text-amber-400",
    "text-pink-400",
    "text-violet-400",
    "text-orange-400",
  ];
  return classes[index % classes.length];
}

export function getProxyBgClass(index: number): string {
  const classes = [
    "bg-blue-400",
    "bg-emerald-400",
    "bg-amber-400",
    "bg-pink-400",
    "bg-violet-400",
    "bg-orange-400",
  ];
  return classes[index % classes.length];
}

export function templateLabel(template: string): string {
  const labels: Record<string, string> = {
    dinner_night: "Dinner Night",
    chill_hangout: "Chill Hangout",
    startup_brainstorm: "Startup Brainstorm",
    study_session: "Study Session",
    remote_coworking: "Remote Coworking",
    custom: "Custom Meetup",
  };
  return labels[template] ?? template;
}

export function templateEmoji(template: string): string {
  const emojis: Record<string, string> = {
    dinner_night: "🍽️",
    chill_hangout: "😎",
    startup_brainstorm: "🚀",
    study_session: "📚",
    remote_coworking: "💻",
    custom: "✨",
  };
  return emojis[template] ?? "📌";
}

export function messageTypeColor(type: string): string {
  const colors: Record<string, string> = {
    proposal: "text-blue-400",
    conflict: "text-red-400",
    compromise: "text-amber-400",
    resolver: "text-white",
    info: "text-slate-400",
  };
  return colors[type] ?? "text-slate-400";
}

export function messageTypeBg(type: string): string {
  const bgs: Record<string, string> = {
    proposal: "bg-blue-400/10 border-blue-400/30",
    conflict: "bg-red-400/10 border-red-400/30",
    compromise: "bg-amber-400/10 border-amber-400/30",
    resolver: "bg-white/10 border-white/30",
    info: "bg-slate-400/10 border-slate-400/20",
  };
  return bgs[type] ?? "bg-slate-400/10 border-slate-400/20";
}

export function budgetLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    low: "Budget",
    medium: "Moderate",
    high: "Premium",
    luxury: "Luxury",
  };
  return labels[level] ?? level;
}

export function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
