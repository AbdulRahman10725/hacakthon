"use client";

import { usePresenceStore } from "@/app/_stores/presenceStore";
import { useSessionStore } from "@/app/_stores/sessionStore";

export default function PresenceLayer() {
  const cursors = usePresenceStore((state) => state.cursors);
  const currentUserId = useSessionStore((state) => state.session?.userId);

  return (
    <div className="presence-layer">
      {Object.values(cursors)
        .filter((cursor) => cursor.userId !== currentUserId)
        .map((cursor) => (
          <div
            key={cursor.userId}
            className="presence-cursor"
            style={{ left: cursor.x, top: cursor.y }}
          >
            <div
              className="presence-dot"
              style={{ backgroundColor: cursor.color }}
            />
            <div
              className="presence-label"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.displayName}
            </div>
          </div>
        ))}
    </div>
  );
}
