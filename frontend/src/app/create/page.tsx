"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createRoom } from "@/lib/api";
import { MeetupTemplate } from "@/types";
import { templateEmoji, templateLabel } from "@/lib/utils";
import Link from "next/link";

const TEMPLATES = [
  MeetupTemplate.DINNER_NIGHT,
  MeetupTemplate.CHILL_HANGOUT,
  MeetupTemplate.STARTUP_BRAINSTORM,
  MeetupTemplate.STUDY_SESSION,
  MeetupTemplate.REMOTE_COWORKING,
  MeetupTemplate.CUSTOM,
];

const TEMPLATE_DESCRIPTIONS: Record<MeetupTemplate, string> = {
  [MeetupTemplate.DINNER_NIGHT]: "Find the perfect restaurant everyone will love",
  [MeetupTemplate.CHILL_HANGOUT]: "Plan a relaxed hangout spot for the crew",
  [MeetupTemplate.STARTUP_BRAINSTORM]: "Book a space to ideate and build together",
  [MeetupTemplate.STUDY_SESSION]: "Find a quiet spot for focused group study",
  [MeetupTemplate.REMOTE_COWORKING]: "Coordinate virtual or co-working meetups",
  [MeetupTemplate.CUSTOM]: "Define your own meetup criteria and goals",
};

export default function CreateRoomPage() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<MeetupTemplate | null>(null);
  const [roomName, setRoomName] = useState("");
  const [location, setLocation] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a meetup type");
      return;
    }
    if (!roomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    setIsLoading(true);
    try {
      const room = await createRoom({
        template: selectedTemplate,
        room_name: roomName.trim(),
        location: location.trim() || undefined,
        time_range_start: timeStart || undefined,
        time_range_end: timeEnd || undefined,
      });
      toast.success("Room created!");
      router.push(`/room/${room.room_id}/join`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create room";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/6 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-violet-600/6 blur-[100px]" />
      </div>
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <span>←</span>
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🤖</span>
            <span className="font-semibold text-white">Proxy</span>
          </div>
        </Link>
        <div className="text-sm text-slate-500">Step 1 of 2</div>
      </nav>

      <main className="relative z-10 max-w-3xl mx-auto px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            Create a Room
          </h1>
          <p className="text-slate-400">
            Choose your meetup type and give your room a name.
          </p>
        </motion.div>

        {/* Template selector */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <label className="block text-sm font-medium text-slate-300 mb-4">
            Meetup Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TEMPLATES.map((template, i) => {
              const isSelected = selectedTemplate === template;
              return (
                <motion.button
                  key={template}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                  onClick={() => setSelectedTemplate(template)}
                  className={`relative group p-4 rounded-xl border text-left transition-all duration-200 ${
                    isSelected
                      ? "border-blue-500/60 bg-blue-500/10 glow-blue"
                      : "border-white/8 bg-[#12121a] hover:border-white/20 hover:bg-[#1a1a2e]"
                  }`}
                >
                  <div className="text-3xl mb-2">{templateEmoji(template)}</div>
                  <div
                    className={`text-sm font-semibold mb-1 ${
                      isSelected ? "text-blue-300" : "text-white"
                    }`}
                  >
                    {templateLabel(template)}
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    {TEMPLATE_DESCRIPTIONS[template]}
                  </div>
                  {isSelected && (
                    <motion.div
                      layoutId="template-selected"
                      className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"
                      initial={false}
                    >
                      <span className="text-white text-xs font-bold">✓</span>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* Form fields */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Room Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Friday Dinner Plans"
              maxLength={60}
              className="w-full px-4 py-3 bg-[#12121a] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-[#1a1a2e] transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              General Location{" "}
              <span className="text-slate-600 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Downtown SF, Brooklyn, Central London"
              className="w-full px-4 py-3 bg-[#12121a] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-[#1a1a2e] transition-all text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Earliest Time{" "}
                <span className="text-slate-600 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className="w-full px-4 py-3 bg-[#12121a] border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:bg-[#1a1a2e] transition-all text-sm [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Latest Time{" "}
                <span className="text-slate-600 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className="w-full px-4 py-3 bg-[#12121a] border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:bg-[#1a1a2e] transition-all text-sm [color-scheme:dark]"
              />
            </div>
          </div>
        </motion.section>

        {/* Submit */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-10"
        >
          <button
            onClick={handleCreate}
            disabled={isLoading || !selectedTemplate || !roomName.trim()}
            className="w-full py-4 px-8 rounded-xl font-semibold text-base text-white bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 glow-blue flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <motion.div
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                Creating Room...
              </>
            ) : (
              <>
                Create Room
                <span>→</span>
              </>
            )}
          </button>
          <p className="text-center text-xs text-slate-600 mt-3">
            You&apos;ll set up your proxy profile on the next screen
          </p>
        </motion.div>
      </main>
    </div>
  );
}
