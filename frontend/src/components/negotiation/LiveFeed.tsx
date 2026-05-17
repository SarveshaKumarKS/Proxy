"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { NegotiationMessage, ProxyAgent } from "@/types";
import { MessageType } from "@/types";
import { formatTimestamp, getProxyColor, messageTypeBg, messageTypeColor } from "@/lib/utils";

interface LiveFeedProps {
  messages: NegotiationMessage[];
  proxies: ProxyAgent[];
}

function messageTypeLabel(type: MessageType): string {
  const labels: Record<MessageType, string> = {
    [MessageType.PROPOSAL]: "Proposal",
    [MessageType.CONFLICT]: "Conflict",
    [MessageType.COMPROMISE]: "Compromise",
    [MessageType.RESOLVER]: "Resolver",
    [MessageType.INFO]: "Info",
  };
  return labels[type] ?? type;
}

function getThinkingProxies(proxies: ProxyAgent[]): ProxyAgent[] {
  return proxies.filter((p) => p.is_thinking);
}

export function LiveFeed({ messages, proxies }: LiveFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const thinkingProxies = getThinkingProxies(proxies);
  const proxyColorMap = Object.fromEntries(
    proxies.map((p, i) => [p.proxy_id, getProxyColor(p.color_index ?? i)])
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold text-white">Live Feed</span>
        </div>
        <span className="text-xs text-slate-600">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-40 text-center"
            >
              <div className="text-3xl mb-2">💬</div>
              <div className="text-sm text-slate-500">
                Negotiation hasn&apos;t started yet.
                <br />
                Start the negotiation to see proxy messages.
              </div>
            </motion.div>
          )}

          {messages.map((msg) => {
            const color = proxyColorMap[msg.proxy_id] ?? "#94a3b8";
            const isResolver = msg.message_type === MessageType.RESOLVER;
            return (
              <motion.div
                key={msg.message_id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, type: "spring", stiffness: 260, damping: 24 }}
                className={`p-3 rounded-xl border ${messageTypeBg(msg.message_type)} ${
                  isResolver ? "border-white/20" : ""
                }`}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border"
                    style={{
                      backgroundColor: `${color}20`,
                      borderColor: `${color}50`,
                      color: color,
                    }}
                  >
                    {msg.avatar_emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold" style={{ color }}>
                      {msg.proxy_name}
                    </span>
                    <span className="text-xs text-slate-600 ml-1">
                      ({msg.human_name})
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full bg-black/20 ${messageTypeColor(msg.message_type)}`}
                  >
                    {messageTypeLabel(msg.message_type)}
                  </span>
                </div>

                {/* Content */}
                <p className="text-sm text-slate-300 leading-relaxed">
                  {msg.content}
                </p>

                {/* Timestamp */}
                <div className="mt-2 text-xs text-slate-600">
                  {formatTimestamp(msg.timestamp)}
                </div>
              </motion.div>
            );
          })}

          {/* Typing indicators */}
          {thinkingProxies.map((proxy) => {
            const color = proxyColorMap[proxy.proxy_id] ?? "#94a3b8";
            return (
              <motion.div
                key={`thinking-${proxy.proxy_id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-[#1a1a2e] border border-white/5"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
                >
                  {proxy.avatar_emoji}
                </div>
                <span className="text-xs font-medium" style={{ color }}>
                  {proxy.proxy_name}
                </span>
                <span className="text-xs text-slate-600">is thinking</span>
                <div className="typing-dots ml-1">
                  <span />
                  <span />
                  <span />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
