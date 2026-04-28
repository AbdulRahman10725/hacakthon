import { create } from "zustand";
import type { Role, UUID } from "@/shared/types";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export interface SessionData {
  token: string;
  roomId: UUID;
  userId: UUID;
  role: Role;
  displayName: string;
  color: string;
}

export interface SessionState {
  session: SessionData | null;
  connectionStatus: ConnectionStatus;
  lastSequenceNumber: number;
  setSession: (session: SessionData | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  updateSequence: (sequence: number) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  connectionStatus: "idle",
  lastSequenceNumber: 0,
  setSession: (session) => set({ session }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  updateSequence: (sequence) =>
    set((state) => ({
      lastSequenceNumber: Math.max(state.lastSequenceNumber, sequence),
    })),
  reset: () => set({ session: null, connectionStatus: "idle", lastSequenceNumber: 0 }),
}));
