"use client";

import CanvasStage from "@/app/_components/canvas/CanvasStage";
import Toolbar from "@/app/_components/toolbar/Toolbar";
import { useSessionStore } from "@/app/_stores/sessionStore";

export default function CanvasWorkspace() {
  const connectionStatus = useSessionStore((state) => state.connectionStatus);

  return (
    <div className="workspace">
      <Toolbar />
      <CanvasStage />
      <div className="connection-status" data-status={connectionStatus}>
        {connectionStatus}
      </div>
    </div>
  );
}
