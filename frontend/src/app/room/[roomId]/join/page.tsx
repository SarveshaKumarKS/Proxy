"use client";

import { useState, use } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { joinRoom } from "@/lib/api";
import { useRoomStore } from "@/stores/roomStore";
import {
  BudgetLevel,
  MeetupPreferences,
  NoiseTolerance,
  OnlineOfflinePreference,
  PersonalitySliders,
  TravelTolerance,
  UserProfile,
} from "@/types";
import { PersonalitySlider } from "@/components/onboarding/PersonalitySlider";
import { generateUserId } from "@/lib/utils";
import Link from "next/link";

const AVATAR_EMOJIS = ["🦊", "🐺", "🦁", "🐯", "🦅", "🦋", "🐉", "🦄", "🤖", "👾", "🎭", "🧙"];

const FOOD_OPTIONS = [
  "No Restrictions",
  "Vegetarian",
  "Vegan",
  "Halal",
  "Gluten-Free",
  "Spicy",
  "Seafood",
];

const DEFAULT_PERSONALITY: PersonalitySliders = {
  diplomatic_assertive: 50,
  practical_adventurous: 50,
  flexible_stubborn: 50,
  concise_expressive: 50,
  analytical_emotional: 50,
  cheap_luxury: 50,
  social_intimate: 50,
};

const DEFAULT_PREFERENCES: MeetupPreferences = {
  food_preferences: ["No Restrictions"],
  noise_tolerance: NoiseTolerance.MEDIUM,
  travel_tolerance: TravelTolerance.MEDIUM,
  budget: BudgetLevel.MEDIUM,
  online_offline: OnlineOfflinePreference.EITHER,
  availability_start: "18:00",
  availability_end: "22:00",
  location: "",
};

const SLIDER_CONFIG = [
  { key: "diplomatic_assertive" as keyof PersonalitySliders, left: "Diplomatic", right: "Assertive", color: "#60a5fa" },
  { key: "practical_adventurous" as keyof PersonalitySliders, left: "Practical", right: "Adventurous", color: "#34d399" },
  { key: "flexible_stubborn" as keyof PersonalitySliders, left: "Flexible", right: "Stubborn", color: "#fbbf24" },
  { key: "concise_expressive" as keyof PersonalitySliders, left: "Concise", right: "Expressive", color: "#f472b6" },
  { key: "analytical_emotional" as keyof PersonalitySliders, left: "Analytical", right: "Emotional", color: "#a78bfa" },
  { key: "cheap_luxury" as keyof PersonalitySliders, left: "Budget-Savvy", right: "Luxury", color: "#fb923c" },
  { key: "social_intimate" as keyof PersonalitySliders, left: "Social", right: "Intimate", color: "#38bdf8" },
];

function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-white/8 overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 px-3 text-xs font-medium transition-all duration-150 ${
            value === opt.value
              ? "bg-blue-500/20 text-blue-300 border-none"
              : "text-slate-500 hover:text-slate-300 bg-transparent"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function JoinPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const setCurrentUser = useRoomStore((s) => s.setCurrentUser);


  const [name, setName] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState("🦊");
  const [personality, setPersonality] = useState<PersonalitySliders>({ ...DEFAULT_PERSONALITY });
  const [preferences, setPreferences] = useState<MeetupPreferences>({ ...DEFAULT_PREFERENCES });
  const [isLoading, setIsLoading] = useState(false);

  const updatePersonality = (key: keyof PersonalitySliders, value: number) => {
    setPersonality((p) => ({ ...p, [key]: value }));
  };

  const toggleFood = (food: string) => {
    setPreferences((p) => {
      const has = p.food_preferences.includes(food);
      if (food === "No Restrictions") {
        return { ...p, food_preferences: has ? [] : ["No Restrictions"] };
      }
      const filtered = p.food_preferences.filter((f) => f !== "No Restrictions");
      return {
        ...p,
        food_preferences: has
          ? filtered.filter((f) => f !== food)
          : [...filtered, food],
      };
    });
  };

  const handleJoin = async () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    const userProfile: UserProfile = {
      user_id: generateUserId(),
      name: name.trim(),
      avatar_emoji: avatarEmoji,
      personality,
      preferences,
    };

    setIsLoading(true);
    try {
      await joinRoom(roomId, userProfile);
      setCurrentUser(userProfile);
      toast.success("Proxy created! Joining room...");
      router.push(`/room/${roomId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join room";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-violet-600/6 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[350px] h-[350px] rounded-full bg-blue-600/6 blur-[100px]" />
      </div>
      <div className="absolute inset-0 bg-grid opacity-25 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-2xl mx-auto">
        <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm">
          <span>🤖</span>
          <span className="font-semibold text-white">Proxy</span>
        </Link>
        <div className="text-sm text-slate-500">Step 2 of 2 — Create Your Proxy</div>
      </nav>

      <main className="relative z-10 max-w-2xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white tracking-tight mb-1">
            Create Your Proxy
          </h1>
          <p className="text-slate-400 text-sm">
            Your AI agent will negotiate on your behalf using these preferences.
          </p>
        </motion.div>

        <div className="space-y-6">
          {/* Identity */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-2xl bg-[#12121a] border border-white/8"
          >
            <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">
              Identity
            </h2>
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-2">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Chen"
                className="w-full px-4 py-3 bg-[#0a0a0f] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-3">Choose Avatar</label>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setAvatarEmoji(emoji)}
                    className={`h-12 w-full rounded-xl text-2xl flex items-center justify-center transition-all duration-150 ${
                      avatarEmoji === emoji
                        ? "bg-blue-500/20 border border-blue-500/50 scale-110"
                        : "bg-[#1a1a2e] border border-white/5 hover:border-white/20"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Personality */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-5 rounded-2xl bg-[#12121a] border border-white/8"
          >
            <h2 className="text-sm font-semibold text-slate-300 mb-1 uppercase tracking-wider">
              Proxy Personality
            </h2>
            <p className="text-xs text-slate-600 mb-5">
              How will your proxy negotiate? Drag to tune its approach.
            </p>
            <div className="space-y-5">
              {SLIDER_CONFIG.map((s) => (
                <PersonalitySlider
                  key={s.key}
                  leftLabel={s.left}
                  rightLabel={s.right}
                  value={personality[s.key]}
                  onChange={(v) => updatePersonality(s.key, v)}
                  color={s.color}
                />
              ))}
            </div>
          </motion.div>

          {/* Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-2xl bg-[#12121a] border border-white/8"
          >
            <h2 className="text-sm font-semibold text-slate-300 mb-5 uppercase tracking-wider">
              Meetup Preferences
            </h2>
            <div className="space-y-5">
              {/* Food */}
              <div>
                <label className="block text-xs text-slate-500 mb-3">
                  Dietary / Food Preferences
                </label>
                <div className="flex flex-wrap gap-2">
                  {FOOD_OPTIONS.map((food) => {
                    const selected = preferences.food_preferences.includes(food);
                    return (
                      <button
                        key={food}
                        onClick={() => toggleFood(food)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border ${
                          selected
                            ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                            : "border-white/10 bg-transparent text-slate-500 hover:text-slate-300 hover:border-white/20"
                        }`}
                      >
                        {food}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Noise */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">
                  Noise Tolerance
                </label>
                <ButtonGroup
                  options={[
                    { label: "Quiet", value: NoiseTolerance.LOW },
                    { label: "Moderate", value: NoiseTolerance.MEDIUM },
                    { label: "Lively", value: NoiseTolerance.HIGH },
                  ]}
                  value={preferences.noise_tolerance}
                  onChange={(v) => setPreferences((p) => ({ ...p, noise_tolerance: v }))}
                />
              </div>

              {/* Travel */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">
                  Travel Tolerance
                </label>
                <ButtonGroup
                  options={[
                    { label: "Close by", value: TravelTolerance.LOW },
                    { label: "30 min", value: TravelTolerance.MEDIUM },
                    { label: "Anywhere", value: TravelTolerance.HIGH },
                  ]}
                  value={preferences.travel_tolerance}
                  onChange={(v) => setPreferences((p) => ({ ...p, travel_tolerance: v }))}
                />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">Budget</label>
                <ButtonGroup
                  options={[
                    { label: "$ Budget", value: BudgetLevel.LOW },
                    { label: "$$ Moderate", value: BudgetLevel.MEDIUM },
                    { label: "$$$ Premium", value: BudgetLevel.HIGH },
                    { label: "$$$$ Luxury", value: BudgetLevel.LUXURY },
                  ]}
                  value={preferences.budget}
                  onChange={(v) => setPreferences((p) => ({ ...p, budget: v }))}
                />
              </div>

              {/* Online/Offline */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">
                  Format Preference
                </label>
                <ButtonGroup
                  options={[
                    { label: "Online", value: OnlineOfflinePreference.ONLINE },
                    { label: "Either", value: OnlineOfflinePreference.EITHER },
                    { label: "In-Person", value: OnlineOfflinePreference.OFFLINE },
                  ]}
                  value={preferences.online_offline}
                  onChange={(v) => setPreferences((p) => ({ ...p, online_offline: v }))}
                />
              </div>

              {/* Availability */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">
                  Availability Window
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">From</label>
                    <input
                      type="time"
                      value={preferences.availability_start}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, availability_start: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 bg-[#0a0a0f] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">To</label>
                    <input
                      type="time"
                      value={preferences.availability_end}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, availability_end: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 bg-[#0a0a0f] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">
                  Your Location / Neighborhood
                </label>
                <input
                  type="text"
                  value={preferences.location}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, location: e.target.value }))
                  }
                  placeholder="e.g. Mission District, Brooklyn, Shoreditch"
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-white/10 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Submit */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <button
            onClick={handleJoin}
            disabled={isLoading || !name.trim()}
            className="w-full py-4 px-8 rounded-xl font-semibold text-base text-white bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 glow-blue flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <motion.div
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                Generating Proxy...
              </>
            ) : (
              <>
                <span>Generate My Proxy</span>
                <span className="text-lg">🤖</span>
              </>
            )}
          </button>
        </motion.div>
      </main>
    </div>
  );
}
