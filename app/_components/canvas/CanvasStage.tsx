"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent } from "react";
import { useCanvasStore } from "@/app/_stores/canvasStore";
import { useUiStore } from "@/app/_stores/uiStore";
import { useSessionStore } from "@/app/_stores/sessionStore";
import { clampScale, screenToWorld } from "@/app/_lib/geometry";
import { sendCanvasDelta, sendCursorMove } from "@/app/_lib/wsClient";
import PresenceLayer from "@/app/_components/canvas/PresenceLayer";
import NodeLayer from "@/app/_components/canvas/NodeLayer";
import type { CanvasNode } from "@/shared/types";

const DEFAULT_SIZES = {
  sticky: { width: 200, height: 160 },
  text: { width: 240, height: 80 },
  rect: { width: 200, height: 140 },
  circle: { width: 140, height: 140 },
};

export default function CanvasStage() {
  const viewport = useCanvasStore((state) => state.viewport);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const updateNode = useCanvasStore((state) => state.updateNode);
  const upsertNode = useCanvasStore((state) => state.upsertNode);
  const getMaxZIndex = useCanvasStore((state) => state.getMaxZIndex);
  const tool = useUiStore((state) => state.tool);
  const selectNode = useUiStore((state) => state.selectNode);
  const setEditingNode = useUiStore((state) => state.setEditingNode);
  const isSpaceDown = useUiStore((state) => state.isSpaceDown);
  const setSpaceDown = useUiStore((state) => state.setSpaceDown);
  const session = useSessionStore((state) => state.session);
  const isReadOnly = session?.role === "VIEWER";

  const stageRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const dragRef = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
    lastSentAt: number;
  } | null>(null);
  const resizeRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    lastSentAt: number;
  } | null>(null);
  const cursorRef = useRef({ lastSentAt: 0 });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceDown(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceDown(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setSpaceDown]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      // Note: this is the DOM PointerEvent (window listener), not React's.
      if (panRef.current?.active) {
        const dx = event.clientX - panRef.current.startX;
        const dy = event.clientY - panRef.current.startY;
        setViewport({ x: panRef.current.originX + dx, y: panRef.current.originY + dy });
        return;
      }

      if (dragRef.current) {
        const world = screenToWorld(
          { x: event.clientX, y: event.clientY },
          viewport
        );
        const nextX = world.x - dragRef.current.offsetX;
        const nextY = world.y - dragRef.current.offsetY;

        updateNode(dragRef.current.nodeId, { x: nextX, y: nextY });

        const now = Date.now();
        if (now - dragRef.current.lastSentAt > 50) {
          dragRef.current.lastSentAt = now;
          sendCanvasDelta({
            nodeId: dragRef.current.nodeId,
            deltaType: "NODE_MOVED",
            x: nextX,
            y: nextY,
          });
        }
        return;
      }

      if (resizeRef.current) {
        const world = screenToWorld(
          { x: event.clientX, y: event.clientY },
          viewport
        );
        const nextWidth = Math.max(80, world.x - resizeRef.current.startX);
        const nextHeight = Math.max(60, world.y - resizeRef.current.startY);

        updateNode(resizeRef.current.nodeId, {
          width: nextWidth,
          height: nextHeight,
        });

        const now = Date.now();
        if (now - resizeRef.current.lastSentAt > 60) {
          resizeRef.current.lastSentAt = now;
          sendCanvasDelta({
            nodeId: resizeRef.current.nodeId,
            deltaType: "NODE_RESIZED",
            x: resizeRef.current.startX,
            y: resizeRef.current.startY,
            width: nextWidth,
            height: nextHeight,
          });
        }
      }
    };

    const handleUp = () => {
      if (dragRef.current) {
        const current = dragRef.current;
        dragRef.current = null;
        sendCanvasDelta({
          nodeId: current.nodeId,
          deltaType: "NODE_MOVED",
          x: useCanvasStore.getState().nodes[current.nodeId]?.x ?? 0,
          y: useCanvasStore.getState().nodes[current.nodeId]?.y ?? 0,
        });
      }

      if (resizeRef.current) {
        const current = resizeRef.current;
        resizeRef.current = null;
        const node = useCanvasStore.getState().nodes[current.nodeId];
        sendCanvasDelta({
          nodeId: current.nodeId,
          deltaType: "NODE_RESIZED",
          x: node?.x ?? current.startX,
          y: node?.y ?? current.startY,
          width: node?.width ?? current.startWidth,
          height: node?.height ?? current.startHeight,
        });
      }

      if (panRef.current?.active) {
        panRef.current.active = false;
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [setViewport, updateNode, viewport]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();

    const scaleChange = event.deltaY < 0 ? 1.1 : 0.9;
    const nextScale = clampScale(viewport.scale * scaleChange);
    // Keep the cursor anchored by converting to world space before scaling.
    const world = screenToWorld(
      { x: event.clientX, y: event.clientY },
      viewport
    );
    const nextX = event.clientX - world.x * nextScale;
    const nextY = event.clientY - world.y * nextScale;

    setViewport({ scale: nextScale, x: nextX, y: nextY });
  };

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button === 1 || isSpaceDown) {
      panRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
      return;
    }

    if (tool === "select" || isReadOnly) {
      selectNode(null);
      setEditingNode(null);
      return;
    }

    if (event.button !== 0) return;

    const stage = stageRef.current;
    if (!stage) return;

    const world = screenToWorld({ x: event.clientX, y: event.clientY }, viewport);
    const nextZ = getMaxZIndex() + 1;

    const base: Partial<CanvasNode> = {
      nodeId: crypto.randomUUID(),
      roomId: session?.roomId ?? "",
      x: world.x,
      y: world.y,
      zIndex: nextZ,
      locked: false,
      lockedBy: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (tool === "sticky") {
      const size = DEFAULT_SIZES.sticky;
      const node: CanvasNode = {
        ...base,
        nodeType: "sticky",
        width: size.width,
        height: size.height,
        textContent: "",
        crdtState: null,
        style: { color: "#FFFDE7" },
        authorId: session?.userId ?? null,
        aiTag: null,
      } as CanvasNode;
      upsertNode(node);
      sendCanvasDelta({
        nodeId: node.nodeId,
        deltaType: "NODE_CREATED",
        nodeType: node.nodeType,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        textContent: node.textContent,
        style: node.style,
        zIndex: node.zIndex,
      });
      return;
    }

    if (tool === "text") {
      const size = DEFAULT_SIZES.text;
      const node: CanvasNode = {
        ...base,
        nodeType: "text",
        width: size.width,
        height: size.height,
        textContent: "Text",
        crdtState: null,
        style: null,
        authorId: session?.userId ?? null,
        aiTag: null,
      } as CanvasNode;
      upsertNode(node);
      sendCanvasDelta({
        nodeId: node.nodeId,
        deltaType: "NODE_CREATED",
        nodeType: node.nodeType,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        textContent: node.textContent,
        style: node.style,
        zIndex: node.zIndex,
      });
      return;
    }

    if (tool === "rect" || tool === "circle") {
      const size = tool === "rect" ? DEFAULT_SIZES.rect : DEFAULT_SIZES.circle;
      const node: CanvasNode = {
        ...base,
        nodeType: tool === "rect" ? "rect" : "circle",
        width: size.width,
        height: size.height,
        textContent: null,
        crdtState: null,
        style: { fill: "#E2E8F0", stroke: "#94A3B8" },
        authorId: session?.userId ?? null,
        aiTag: null,
      } as CanvasNode;
      upsertNode(node);
      sendCanvasDelta({
        nodeId: node.nodeId,
        deltaType: "NODE_CREATED",
        nodeType: node.nodeType,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        style: node.style,
        zIndex: node.zIndex,
      });
    }
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!session) return;

    const now = Date.now();
    if (now - cursorRef.current.lastSentAt < 50) return;
    cursorRef.current.lastSentAt = now;

    // Cursor presence is sent in world coordinates to align across clients.
    const world = screenToWorld({ x: event.clientX, y: event.clientY }, viewport);
    sendCursorMove({
      x: world.x,
      y: world.y,
      displayName: session.displayName,
      color: session.color,
    });
  };

  const stageStyle = useMemo(() => {
    return {
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
    } as CSSProperties;
  }, [viewport]);

  return (
    <div
      className="canvas-stage"
      ref={stageRef}
      onWheel={handleWheel}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
    >
      <div className="canvas-content" style={stageStyle}>
        <NodeLayer
          onStartDrag={(nodeId, offset) => {
            dragRef.current = {
              nodeId,
              offsetX: offset.x,
              offsetY: offset.y,
              lastSentAt: 0,
            };
          }}
          onStartResize={(nodeId, start, size) => {
            resizeRef.current = {
              nodeId,
              startX: start.x,
              startY: start.y,
              startWidth: size.width,
              startHeight: size.height,
              lastSentAt: 0,
            };
          }}
        />
        <PresenceLayer />
      </div>
    </div>
  );
}
