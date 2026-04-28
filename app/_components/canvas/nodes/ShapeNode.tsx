"use client";

import type { PointerEvent } from "react";
import type { NodeComponentProps } from "@/app/_components/canvas/NodeLayer";
import { useUiStore } from "@/app/_stores/uiStore";
import { screenToWorld } from "@/app/_lib/geometry";
import { useCanvasStore } from "@/app/_stores/canvasStore";
import { sendCanvasDelta } from "@/app/_lib/wsClient";
import { useSessionStore } from "@/app/_stores/sessionStore";

interface ShapeNodeProps extends NodeComponentProps {
  shapeType: "rect" | "circle";
}

export default function ShapeNode({
  node,
  selected,
  onStartDrag,
  onStartResize,
  shapeType,
}: ShapeNodeProps) {
  const viewport = useCanvasStore((state) => state.viewport);
  const selectNode = useUiStore((state) => state.selectNode);
  const updateNode = useCanvasStore((state) => state.updateNode);
  const isReadOnly = useSessionStore((state) => state.session?.role === "VIEWER");

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

  return (
    <div
      className={`node shape-node ${shapeType} ${selected ? "selected" : ""}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width ?? 200,
        height: node.height ?? 140,
      }}
      onPointerDown={handlePointerDown}
    >
      {selected && (
        <div className="resize-handle" onPointerDown={handleResizeDown} />
      )}
    </div>
  );
}
