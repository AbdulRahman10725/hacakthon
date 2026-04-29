"use client";

import { useMemo } from "react";
import { useCanvasStore } from "@/app/_stores/canvasStore";
import { useUiStore } from "@/app/_stores/uiStore";
import type { CanvasNode } from "@/shared/types";
import StickyNote from "@/app/_components/canvas/nodes/StickyNote";
import TextNode from "@/app/_components/canvas/nodes/TextNode";
import ShapeNode from "@/app/_components/canvas/nodes/ShapeNode";

interface NodeLayerProps {
  onStartDrag: (nodeId: string, offset: { x: number; y: number }) => void;
  onStartResize: (
    nodeId: string,
    start: { x: number; y: number },
    size: { width: number; height: number }
  ) => void;
}

export default function NodeLayer({ onStartDrag, onStartResize }: NodeLayerProps) {
  const nodes = useCanvasStore((state) => state.nodes);
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);

  const ordered = useMemo(() => {
    return Object.values(nodes).sort(
      (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)
    );
  }, [nodes]);

  return (
    <>
      {ordered.map((node) => {
        const selected = node.nodeId === selectedNodeId;

        const commonProps = {
          node,
          selected,
          onStartDrag,
          onStartResize,
        };

        if (node.nodeType === "sticky") {
          return (
            <StickyNote
              key={node.nodeId}
              {...commonProps}
            />
          );
        }

        if (node.nodeType === "text") {
          return (
            <TextNode
              key={node.nodeId}
              {...commonProps}
            />
          );
        }

        if (node.nodeType === "rect" || node.nodeType === "circle") {
          return (
            <ShapeNode
              key={node.nodeId}
              shapeType={node.nodeType}
              {...commonProps}
            />
          );
        }

        return (
          <ShapeNode
            key={node.nodeId}
            shapeType="rect"
            {...commonProps}
          />
        );
      })}
    </>
  );
}

export interface NodeComponentProps {
  node: CanvasNode;
  selected: boolean;
  onStartDrag: (
    nodeId: string,
    offset: { x: number; y: number }
  ) => void;

  onStartResize: (
    nodeId: string,
    start: { x: number; y: number },
    size: { width: number; height: number }
  ) => void;
}