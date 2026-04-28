"use client";

import { useState } from "react";
import type { PointerEvent } from "react";
import { useCanvasStore } from "@/app/_stores/canvasStore";
import type { CanvasStoreState } from "@/app/_stores/canvasStore";
import { useUiStore } from "@/app/_stores/uiStore";
import type { UiState } from "@/app/_stores/uiStore";
import { sendCanvasDelta } from "@/app/_lib/wsClient";
import type { NodeComponentProps } from "@/app/_components/canvas/NodeLayer";
import { screenToWorld } from "@/app/_lib/geometry";
import { useCanvasStore as useViewportStore } from "@/app/_stores/canvasStore";
import { useSessionStore } from "@/app/_stores/sessionStore";
import type { SessionState } from "@/app/_stores/sessionStore";

export default function TextNode({ node, selected, onStartDrag, onStartResize }: NodeComponentProps) {
  const viewport = useViewportStore((state: CanvasStoreState) => state.viewport);
  const selectNode = useUiStore((state: UiState) => state.selectNode);
  const editingNodeId = useUiStore((state: UiState) => state.editingNodeId);
  const setEditingNode = useUiStore((state: UiState) => state.setEditingNode);
  const updateNode = useCanvasStore((state: CanvasStoreState) => state.updateNode);
  const isReadOnly = useSessionStore(
    (state: SessionState) => state.session?.role === "VIEWER"
  );
  const [draft, setDraft] = useState(node.textContent ?? "");
  const isEditing = editingNodeId === node.nodeId;

  const bringToFront = () => {
    const maxZ = useCanvasStore.getState().getMaxZIndex();
    if ((node.zIndex ?? 0) >= maxZ) return;
    const nextZ = maxZ + 1;
    updateNode(node.nodeId, { zIndex: nextZ });
    sendCanvasDelta({
      nodeId: node.nodeId,
      deltaType: "NODE_Z_CHANGED",
      zIndex: nextZ,
    });
  };

  const startEditing = () => {
    setDraft(node.textContent ?? "");
    setEditingNode(node.nodeId);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (isReadOnly) return;
    selectNode(node.nodeId);
    bringToFront();

    if (event.button !== 0) return;
    const world = screenToWorld({ x: event.clientX, y: event.clientY }, viewport);
    onStartDrag(node.nodeId, { x: world.x - node.x, y: world.y - node.y });
  };

  const handleResizeDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (isReadOnly) return;
    onStartResize(
      node.nodeId,
      { x: node.x, y: node.y },
      { width: node.width ?? 0, height: node.height ?? 0 }
    );
  };

  const commitText = () => {
    if (isReadOnly) return;
    setEditingNode(null);
    updateNode(node.nodeId, { textContent: draft });
    sendCanvasDelta({
      nodeId: node.nodeId,
      deltaType: "NODE_TEXT_UPDATED",
      textContent: draft,
    });
  };

  return (
    <div
      className={`node text-node ${selected ? "selected" : ""}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width ?? 240,
        height: node.height ?? 80,
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={() => {
        if (!isReadOnly) startEditing();
      }}
    >
      {isEditing ? (
        <textarea
          className="node-editor"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitText}
          autoFocus
        />
      ) : (
        <div className="node-text">{node.textContent || ""}</div>
      )}
      {selected && (
        <div className="resize-handle" onPointerDown={handleResizeDown} />
      )}
    </div>
  );
}
