import { create } from "zustand";
import type { UUID } from "@/shared/types";

export interface CursorPresence {
  userId: UUID;
  displayName: string;
  color: string;
  x: number;
  y: number;
  status?: string;
  lastUpdated: number;
}

interface PresenceState {
  cursors: Record<UUID, CursorPresence>;
  setMembers: (members: Array<{ userId: UUID; displayName: string; color: string }>) => void;
  updateCursor: (cursor: CursorPresence) => void;
  removeCursor: (userId: UUID) => void;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  cursors: {},
  setMembers: (members) => {
    const now = Date.now();
    const cursors: Record<UUID, CursorPresence> = {};
    members.forEach((member) => {
      cursors[member.userId] = {
        userId: member.userId,
        displayName: member.displayName,
        color: member.color,
        x: 0,
        y: 0,
        lastUpdated: now,
      };
    });
    set({ cursors });
  },
  updateCursor: (cursor) =>
    set((state) => ({
      cursors: { ...state.cursors, [cursor.userId]: cursor },
    })),
  removeCursor: (userId) =>
    set((state) => {
      if (!state.cursors[userId]) return state;
      const next = { ...state.cursors };
      delete next[userId];
      return { cursors: next };
    }),
  clear: () => set({ cursors: {} }),
}));
