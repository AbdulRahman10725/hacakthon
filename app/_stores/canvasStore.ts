import { create } from "zustand";
import type { CanvasNode, UUID } from "@/shared/types";

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasStoreState {
  nodes: Record<UUID, CanvasNode>;
  viewport: ViewportState;
  setViewport: (partial: Partial<ViewportState>) => void;
  setNodes: (nodes: CanvasNode[]) => void;
  upsertNode: (node: CanvasNode) => void;
  updateNode: (nodeId: UUID, patch: Partial<CanvasNode>) => void;
  removeNode: (nodeId: UUID) => void;
  getMaxZIndex: () => number;
  reset: () => void;
}

const defaultViewport: ViewportState = { x: 0, y: 0, scale: 1 };

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  nodes: {},
  viewport: defaultViewport,
  setViewport: (partial) =>
    set((state) => ({ viewport: { ...state.viewport, ...partial } })),
  setNodes: (nodes) => {
    const map: Record<UUID, CanvasNode> = {};
    nodes.forEach((node) => {
      map[node.nodeId] = node;
    });
    set({ nodes: map });
  },
  upsertNode: (node) =>
    set((state) => ({ nodes: { ...state.nodes, [node.nodeId]: node } })),
  updateNode: (nodeId, patch) =>
    set((state) => {
      const existing = state.nodes[nodeId];
      if (!existing) return state;
      return {
        nodes: { ...state.nodes, [nodeId]: { ...existing, ...patch } },
      };
    }),
  removeNode: (nodeId) =>
    set((state) => {
      if (!state.nodes[nodeId]) return state;
      const next = { ...state.nodes };
      delete next[nodeId];
      return { nodes: next };
    }),
  getMaxZIndex: () => {
    const nodes = Object.values(get().nodes);
    if (nodes.length === 0) return 0;
    return Math.max(...nodes.map((node) => node.zIndex ?? 0));
  },
  reset: () => set({ nodes: {}, viewport: defaultViewport }),
}));
