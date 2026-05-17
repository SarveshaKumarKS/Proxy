"use client";

import { motion } from "framer-motion";
import Link from "next/link";

// Animated background particles
function Particles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${5 + (i * 5.3) % 90}%`,
    delay: i * 0.55,
    duration: 8 + (i % 5) * 2,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-1 h-1 rounded-full bg-blue-400/30"
          style={{ left: p.left, bottom: "-10px" }}
          animate={{
            y: [0, -900],
            x: [0, (p.id % 2 === 0 ? 40 : -40)],
            opacity: [0, 0.6, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

// Animated SVG network graph
function NetworkGraph() {
  const nodes = [
    { id: 0, x: 180, y: 140, color: "#60a5fa", label: "Alex", emoji: "👩" },
    { id: 1, x: 370, y: 70, color: "#34d399", label: "Sam", emoji: "👨" },
    { id: 2, x: 480, y: 210, color: "#fbbf24", label: "Jordan", emoji: "🧑" },
    { id: 3, x: 360, y: 340, color: "#f472b6", label: "Riley", emoji: "👩" },
    { id: 4, x: 150, y: 290, color: "#a78bfa", label: "Casey", emoji: "👨" },
    { id: 5, x: 310, y: 200, color: "#ffffff", label: "Proxy", emoji: "🤖", isCenter: true },
  ];

  const edges = [
    { from: 0, to: 5, isCenter: true },
    { from: 1, to: 5, isCenter: true },
    { from: 2, to: 5, isCenter: true },
    { from: 3, to: 5, isCenter: true },
    { from: 4, to: 5, isCenter: true },
    { from: 0, to: 1, isCenter: false },
    { from: 2, to: 3, isCenter: false },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg viewBox="60 40 500 340" className="w-full h-full max-w-lg">
        {edges.map((edge, i) => {
          const from = nodes[edge.from];
          const to = nodes[edge.to];
          return (
            <motion.line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={edge.isCenter ? "#60a5fa" : "#334155"}
              strokeWidth={edge.isCenter ? 1.5 : 1}
              animate={{
                strokeOpacity: edge.isCenter
                  ? [0.25, 0.65, 0.25]
                  : [0.08, 0.18, 0.08],
              }}
              transition={{
                duration: 2 + i * 0.25,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.15,
              }}
            />
          );
        })}

        {nodes.map((node) => (
          <g key={node.id}>
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={node.isCenter ? 30 : 22}
              fill="none"
              stroke={node.color}
              strokeWidth={1}
              strokeOpacity={0}
              animate={{
                r: [node.isCenter ? 30 : 22, node.isCenter ? 44 : 34],
                strokeOpacity: [0.4, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
                delay: node.id * 0.4,
              }}
            />
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={node.isCenter ? 24 : 18}
              fill={
                node.isCenter
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(10,10,15,0.85)"
              }
              stroke={node.color}
              strokeWidth={node.isCenter ? 2 : 1.5}
              animate={node.isCenter ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <text
              x={node.x}
              y={node.y + 5}
              textAnchor="middle"
              fontSize={node.isCenter ? 16 : 13}
            >
              {node.emoji}
            </text>
            <text
              x={node.x}
              y={node.y + (node.isCenter ? 46 : 38)}
              textAnchor="middle"
              fill={node.color}
              fontSize={node.isCenter ? 12 : 10}
              fontFamily="Inter, sans-serif"
              fontWeight={node.isCenter ? "600" : "400"}
              opacity={0.9}
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const features = [
  {
    icon: "🤖",
    title: "AI Proxy Agents",
    description:
      "Your proxy learns your personality and preferences, then negotiates on your behalf — no compromise required from you.",
  },
  {
    icon: "⚖️",
    title: "Fairness Scoring",
    description:
      "Real-time metrics track group alignment, travel fairness, budget harmony, and compromise balance.",
  },
  {
    icon: "⚡",
    title: "Live Negotiation",
    description:
      "Watch proxies negotiate in real time. Intervene, veto, or relax constraints whenever you want full control.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="orb-animate absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/8 blur-[120px]" />
        <div className="orb-animate-delay absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-[120px]" />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full bg-emerald-600/5 blur-[80px]" />
      </div>

      {/* Grid background */}
      <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

      {/* Particles */}
      <Particles />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-sm">
            🤖
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">
            Proxy
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/create"
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Create Room
          </Link>
          <Link
            href="/create"
            className="px-4 py-2 text-sm font-medium bg-blue-500/20 border border-blue-500/40 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-all"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero section */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[calc(100vh-160px)]">
          {/* Left: Text */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium mb-6">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                AI-Powered Group Planning
              </div>

              <h1 className="text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight">
                Stop arguing
                <br />
                <span className="gradient-text">in group chats.</span>
              </h1>

              <p className="text-2xl font-light text-slate-300 mt-4 leading-relaxed">
                Let your proxies negotiate.
              </p>

              <p className="text-lg text-slate-400 mt-4 leading-relaxed max-w-lg">
                Your AI representative negotiates group meetup plans for
                you — accounting for everyone&apos;s preferences, schedules,
                and budget.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link
                href="/create"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-blue-500 rounded-xl hover:bg-blue-400 transition-all duration-200 glow-blue"
              >
                <span>Create Room</span>
                <motion.span
                  className="text-lg"
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  →
                </motion.span>
              </Link>

              <button className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-medium text-slate-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-all duration-200">
                Watch Demo
                <span>▶</span>
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="flex items-center gap-6 text-sm text-slate-500"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> No sign-up required
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Free to use
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Real-time results
              </div>
            </motion.div>
          </div>

          {/* Right: Animated graph */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative h-[420px] rounded-2xl bg-[#12121a] border border-white/8 overflow-hidden"
          >
            <div className="absolute inset-0 bg-grid opacity-30" />
            <NetworkGraph />
            {/* Floating badge 1 */}
            <motion.div
              className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-[#0a0a0f]/90 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 font-medium"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Consensus reached · 94% alignment
            </motion.div>
            {/* Floating badge 2 */}
            <motion.div
              className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-[#0a0a0f]/90 border border-blue-500/30 rounded-lg text-xs text-blue-300 font-medium"
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            >
              🍽️ Sushi Nori · Downtown
            </motion.div>
          </motion.div>
        </div>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="mt-24 grid md:grid-cols-3 gap-6"
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
              className="relative group p-6 rounded-2xl bg-[#12121a] border border-white/8 hover:border-blue-500/30 transition-all duration-300 hover:bg-[#1a1a2e] overflow-hidden"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {feature.description}
              </p>
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at 50% 0%, rgba(96,165,250,0.04), transparent 70%)",
                }}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="mt-24 text-center"
        >
          <div className="inline-block p-px rounded-2xl bg-gradient-to-r from-blue-500/30 via-violet-500/30 to-emerald-500/30">
            <div className="px-12 py-10 rounded-2xl bg-[#12121a]">
              <h2 className="text-3xl font-bold text-white mb-3">
                Ready to stop the group chat chaos?
              </h2>
              <p className="text-slate-400 mb-6">
                Create a room, invite your friends, and let the proxies do the
                work.
              </p>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-blue-500 rounded-xl hover:bg-blue-400 transition-all glow-blue"
              >
                Create Your First Room →
              </Link>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
