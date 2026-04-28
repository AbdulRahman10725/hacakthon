import { create } from "zustand";
import type { UUID } from "@/shared/types";

export type ToolType = "select" | "sticky" | "text" | "rect" | "circle";

export interface UiState {
  tool: ToolType;
  selectedNodeId: UUID | null;
  editingNodeId: UUID | null;
  isSpaceDown: boolean;
  setTool: (tool: ToolType) => void;
  selectNode: (nodeId: UUID | null) => void;
  setEditingNode: (nodeId: UUID | null) => void;
  setSpaceDown: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  tool: "select",
  selectedNodeId: null,
  editingNodeId: null,
  isSpaceDown: false,
  setTool: (tool) => set({ tool }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setEditingNode: (nodeId) => set({ editingNodeId: nodeId }),
  setSpaceDown: (value) => set({ isSpaceDown: value }),
}));
