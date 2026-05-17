"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRoomStore } from "@/stores/roomStore";

interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (type: string, data: unknown) => void;
}

export function useWebSocket(roomId: string | null): UseWebSocketReturn {
  const connectWS = useRoomStore((s) => s.connectWS);
  const disconnectWS = useRoomStore((s) => s.disconnectWS);
  const sendWSMessage = useRoomStore((s) => s.sendWSMessage);
  const isConnected = useRoomStore((s) => s.isConnected);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;
    if (connectedRef.current) return;
    connectedRef.current = true;
    connectWS(roomId);

    return () => {
      connectedRef.current = false;
      disconnectWS();
    };
  }, [roomId, connectWS, disconnectWS]);

  const sendMessage = useCallback(
    (type: string, data: unknown) => {
      sendWSMessage(type, data);
    },
    [sendWSMessage]
  );

  return { isConnected, sendMessage };
}
