"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import type { NegotiationMessage, ProxyAgent } from "@/types";
import { getProxyColor } from "@/lib/utils";
import { MessageType } from "@/types";

// ---- Custom Proxy Node ----
interface ProxyNodeData extends Record<string, unknown> {
  proxyName: string;
  humanName: string;
  emoji: string;
  color: string;
  isThinking: boolean;
}

type ProxyNodeType = Node<ProxyNodeData>;

function ProxyNode({ data }: NodeProps<ProxyNodeType>) {
  const d = data as ProxyNodeData;
  return (
    <div className="flex flex-col items-center select-none">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      <motion.div
        className="relative"
        animate={d.isThinking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 1.5, repeat: d.isThinking ? Infinity : 0, ease: "easeInOut" }}
      >
        {/* Outer glow ring */}
        <AnimatePresence>
          {d.isThinking && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: d.color, filter: "blur(12px)" }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.2, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>

        {/* Main circle */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl relative z-10 border-2"
          style={{
            backgroundColor: `${d.color}18`,
            borderColor: d.color,
            boxShadow: `0 0 16px ${d.color}40, 0 0 32px ${d.color}20`,
          }}
        >
          {d.emoji}
        </div>
      </motion.div>

      {/* Labels */}
      <div className="mt-2 text-center">
        <div className="text-sm font-semibold" style={{ color: d.color }}>
          {d.proxyName}
        </div>
        <div className="text-xs text-slate-500">{d.humanName}</div>
      </div>

      {d.isThinking && (
        <div className="mt-1.5 typing-dots">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

// ---- Resolver Node ----
interface ResolverNodeData extends Record<string, unknown> {
  label: string;
}

type ResolverNodeType = Node<ResolverNodeData>;

function ResolverNode({ data }: NodeProps<ResolverNodeType>) {
  const d = data as ResolverNodeData;
  return (
    <div className="flex flex-col items-center select-none">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      <motion.div
        className="relative"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        {/* Diamond shape via rotation */}
        <motion.div
          className="w-14 h-14 flex items-center justify-center relative"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="absolute inset-0 rounded-sm rotate-45"
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.5)",
              boxShadow:
                "0 0 20px rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.1)",
            }}
          />
          <span className="relative z-10 text-lg" style={{ transform: "rotate(0deg)" }}>
            ⚖️
          </span>
        </motion.div>
      </motion.div>

      <div className="mt-2 text-center">
        <div className="text-xs font-semibold text-white/80">{d.label}</div>
        <div className="text-xs text-slate-600">Resolver</div>
      </div>
    </div>
  );
}

const nodeTypes = {
  proxyNode: ProxyNode,
  resolverNode: ResolverNode,
};

// ---- Edge color logic ----
function getEdgeColor(
  sourceId: string,
  targetId: string,
  messages: NegotiationMessage[]
): { color: string; animated: boolean } {
  const recentMessages = messages.slice(-20);
  let hasConflict = false;
  let hasConsensus = false;

  for (const msg of recentMessages) {
    const involves =
      msg.proxy_id === sourceId ||
      msg.proxy_id === targetId ||
      msg.target_proxy_id === sourceId ||
      msg.target_proxy_id === targetId;

    if (involves) {
      if (msg.message_type === MessageType.CONFLICT) hasConflict = true;
      if (msg.message_type === MessageType.COMPROMISE) hasConsensus = true;
    }
  }

  if (hasConflict) return { color: "#f87171", animated: true };
  if (hasConsensus) return { color: "#34d399", animated: true };
  return { color: "#334155", animated: false };
}

// ---- Main Component ----
interface NegotiationGraphProps {
  proxies: ProxyAgent[];
  messages: NegotiationMessage[];
}

export function NegotiationGraph({ proxies, messages }: NegotiationGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const layoutNodes = useCallback(() => {
    if (!proxies || proxies.length === 0) return;

    const centerX = 400;
    const centerY = 300;
    const radius = Math.min(200, 60 + proxies.length * 40);

    // Resolver node at center
    const resolverNode: Node = {
      id: "resolver",
      type: "resolverNode",
      position: { x: centerX - 40, y: centerY - 40 },
      data: { label: "AI Resolver" },
      draggable: true,
    };

    // Proxy nodes in a circle
    const proxyNodes: Node[] = proxies.map((proxy, i) => {
      const angle = (i / proxies.length) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle) - 40;
      const y = centerY + radius * Math.sin(angle) - 60;
      return {
        id: proxy.proxy_id,
        type: "proxyNode",
        position: { x, y },
        data: {
          proxyName: proxy.proxy_name,
          humanName: proxy.human_name,
          emoji: proxy.avatar_emoji,
          color: getProxyColor(proxy.color_index ?? i),
          isThinking: proxy.is_thinking ?? false,
        },
        draggable: true,
      };
    });

    // Edges: each proxy to resolver + between adjacent proxies
    const newEdges: Edge[] = [];

    proxyNodes.forEach((pNode, i) => {
      const proxy = proxies[i];
      const edgeStyle = getEdgeColor(proxy.proxy_id, "resolver", messages);
      newEdges.push({
        id: `${proxy.proxy_id}-resolver`,
        source: proxy.proxy_id,
        target: "resolver",
        animated: edgeStyle.animated,
        style: { stroke: edgeStyle.color, strokeWidth: 1.5, opacity: 0.6 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeStyle.color },
      });
    });

    // Cross-proxy edges for recent interactions
    const recentInteractions = new Set<string>();
    messages.slice(-10).forEach((msg) => {
      if (msg.target_proxy_id && msg.target_proxy_id !== "resolver") {
        const key = [msg.proxy_id, msg.target_proxy_id].sort().join("-");
        recentInteractions.add(key);
      }
    });

    recentInteractions.forEach((key) => {
      const [srcId, tgtId] = key.split("-");
      const edgeStyle = getEdgeColor(srcId, tgtId, messages);
      newEdges.push({
        id: `cross-${key}`,
        source: srcId,
        target: tgtId,
        animated: edgeStyle.animated,
        style: { stroke: edgeStyle.color, strokeWidth: 1, opacity: 0.4, strokeDasharray: "4 4" },
      });
    });

    setNodes([resolverNode, ...proxyNodes]);
    setEdges(newEdges);
  }, [proxies, messages, setNodes, setEdges]);

  useEffect(() => {
    layoutNodes();
  }, [layoutNodes]);

  if (!proxies || proxies.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0d14] gap-4">
        <motion.div
          className="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-2xl"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          ⏳
        </motion.div>
        <div className="text-slate-500 text-sm text-center">
          <div className="font-medium text-slate-400">Waiting for participants</div>
          <div>Share the room link to invite others</div>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.4}
      maxZoom={2}
      colorMode="dark"
      style={{ background: "#0d0d14" }}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="rgba(255,255,255,0.04)"
      />
    </ReactFlow>
  );
}
