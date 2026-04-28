"use client";

import { useUiStore } from "@/app/_stores/uiStore";

const tools = [
  { key: "select", label: "Select" },
  { key: "sticky", label: "Sticky" },
  { key: "text", label: "Text" },
  { key: "rect", label: "Rect" },
  { key: "circle", label: "Circle" },
] as const;

export default function Toolbar() {
  const tool = useUiStore((state) => state.tool);
  const setTool = useUiStore((state) => state.setTool);

  return (
    <div className="toolbar">
      {tools.map((item) => (
        <button
          key={item.key}
          className={`toolbar-button ${tool === item.key ? "active" : ""}`}
          onClick={() => setTool(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
