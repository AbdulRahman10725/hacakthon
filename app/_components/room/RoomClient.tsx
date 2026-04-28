"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { WsEnvelope } from "@/shared/protocol";
import { applyEnvelope } from "@/app/_lib/canvasEvents";
import { loadSession } from "@/app/_lib/storage";
import { setActiveClient, WsClient } from "@/app/_lib/wsClient";
import { useSessionStore } from "@/app/_stores/sessionStore";
import { useCanvasStore } from "@/app/_stores/canvasStore";
import { usePresenceStore } from "@/app/_stores/presenceStore";
import CanvasWorkspace from "@/app/_components/canvas/CanvasWorkspace";

interface RoomClientProps {
  roomId: string;
}

export default function RoomClient({ roomId }: RoomClientProps) {
  const router = useRouter();
  const { session, setSession, setConnectionStatus } = useSessionStore();
  const wsRef = useRef<WsClient | null>(null);

  useEffect(() => {
    if (!session) {
      const stored = loadSession();
      if (stored) {
        setSession(stored);
      }
    }
  }, [session, setSession]);

  useEffect(() => {
    if (!session) return;
    if (session.roomId !== roomId) return;

    const client = new WsClient({
      roomId: session.roomId,
      token: session.token,
      onMessage: (message: WsEnvelope) => {
        applyEnvelope(message);
      },
      onStatus: (status) => {
        setConnectionStatus(status === "connected" ? "connected" : status);
      },
      getLastSequence: () => useSessionStore.getState().lastSequenceNumber,
    });

    wsRef.current = client;
    setActiveClient(client);
    client.connect();

    return () => {
      setActiveClient(null);
      client.disconnect();
    };
  }, [roomId, session, setConnectionStatus]);

  useEffect(() => {
    if (session && session.roomId !== roomId) {
      router.push("/");
    }
  }, [roomId, router, session]);

  useEffect(() => {
    return () => {
      useCanvasStore.getState().reset();
      usePresenceStore.getState().clear();
    };
  }, []);

  const ready = useMemo(() => session && session.roomId === roomId, [session, roomId]);

  if (!ready) {
    return (
      <div className="room-loading">
        <div className="room-loading-card">
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  return <CanvasWorkspace />;
}
