import type { CanvasEvent, CanvasNode, UUID } from "@/shared/types";
import type { WsEnvelope } from "@/shared/protocol";
import { useCanvasStore } from "@/app/_stores/canvasStore";
import { usePresenceStore } from "@/app/_stores/presenceStore";
import { useSessionStore } from "@/app/_stores/sessionStore";

export function applyFullState(payload: {
  nodes: CanvasNode[];
  members: Array<{ userId: UUID; displayName: string; role: string; color: string }>;
}): void {
  useCanvasStore.getState().setNodes(payload.nodes);
  usePresenceStore.getState().setMembers(payload.members);
}

export function applyReplayEvents(events: CanvasEvent[]): void {
  events.forEach((event) => applyEvent(event));
}

export function applyEnvelope(envelope: WsEnvelope): void {
  if (typeof envelope.sequenceNumber === "number") {
    useSessionStore.getState().updateSequence(envelope.sequenceNumber);
  }

  switch (envelope.type) {
    case "CANVAS_DELTA":
      applyDelta(envelope.payload as Record<string, unknown>);
      return;
    case "USER_JOINED": {
      const payload = envelope.payload as Record<string, unknown>;
      if (!envelope.userId) return;
      usePresenceStore.getState().updateCursor({
        userId: envelope.userId,
        displayName: String(payload.displayName ?? "User"),
        color: String(payload.color ?? "#2B6CB0"),
        x: 0,
        y: 0,
        lastUpdated: Date.now(),
      });
      return;
    }
    case "USER_LEFT": {
      if (!envelope.userId) return;
      usePresenceStore.getState().removeCursor(envelope.userId);
      return;
    }
    case "REPLAY_EVENTS": {
      const payload = envelope.payload as { events: CanvasEvent[] };
      payload.events.forEach((event) => applyEvent(event));
      return;
    }
    case "FULL_STATE": {
      const payload = envelope.payload as {
        nodes: CanvasNode[];
        members: Array<{ userId: UUID; displayName: string; role: string; color: string }>;
      };
      applyFullState(payload);
      if (typeof envelope.sequenceNumber === "number") {
        useSessionStore.getState().updateSequence(envelope.sequenceNumber);
      }
      return;
    }
    case "CURSOR_MOVE": {
      if (!envelope.userId) return;
      const payload = envelope.payload as Record<string, unknown>;
      usePresenceStore.getState().updateCursor({
        userId: envelope.userId,
        displayName: String(payload.displayName ?? "User"),
        color: String(payload.color ?? "#2B6CB0"),
        x: Number(payload.x ?? 0),
        y: Number(payload.y ?? 0),
        status: payload.status ? String(payload.status) : undefined,
        lastUpdated: Date.now(),
      });
      return;
    }
  }
}

export function applyEvent(event: CanvasEvent): void {
  useSessionStore.getState().updateSequence(event.sequenceNumber);

  switch (event.eventType) {
    case "NODE_CREATED":
    case "NODE_MOVED":
    case "NODE_RESIZED":
    case "NODE_TEXT_UPDATED":
    case "NODE_STYLE_CHANGED":
    case "NODE_DELETED":
    case "NODE_LOCKED":
    case "NODE_UNLOCKED":
    case "NODE_Z_CHANGED":
      applyDelta(event.payload as Record<string, unknown>);
      return;
    case "USER_JOINED": {
      const payload = event.payload as Record<string, unknown>;
      usePresenceStore.getState().updateCursor({
        userId: payload.userId as UUID,
        displayName: String(payload.displayName ?? "User"),
        color: String(payload.color ?? "#2B6CB0"),
        x: 0,
        y: 0,
        lastUpdated: Date.now(),
      });
      return;
    }
    case "USER_LEFT": {
      const payload = event.payload as Record<string, unknown>;
      usePresenceStore.getState().removeCursor(payload.userId as UUID);
      return;
    }
  }
}

export function applyDelta(payload: Record<string, unknown>): void {
  const nodeId = payload.nodeId as UUID | undefined;
  const deltaType = payload.deltaType as string | undefined;
  if (!nodeId || !deltaType) return;

  const canvas = useCanvasStore.getState();

  if (deltaType === "NODE_CREATED") {
    const sessionRoomId = useSessionStore.getState().session?.roomId ?? "";
    const node: CanvasNode = {
      nodeId,
      roomId: String(payload.roomId ?? sessionRoomId) as UUID,
      nodeType: String(payload.nodeType ?? payload.type ?? "unknown"),
      x: Number(payload.x ?? 0),
      y: Number(payload.y ?? 0),
      width: (payload.width ?? payload.w ?? null) as number | null,
      height: (payload.height ?? payload.h ?? null) as number | null,
      textContent: (payload.textContent ?? payload.text ?? null) as string | null,
      crdtState: Array.isArray(payload.crdtUpdate) ? (payload.crdtUpdate as number[]) : null,
      style: (payload.style ?? null) as Record<string, unknown> | null,
      authorId: (payload.authorId ?? null) as UUID | null,
      aiTag: (payload.aiTag ?? null) as string | null,
      locked: Boolean(payload.locked ?? false),
      lockedBy: (payload.lockedBy ?? null) as UUID | null,
      zIndex: Number(payload.zIndex ?? 0),
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    canvas.upsertNode(node);
    return;
  }

  if (deltaType === "NODE_MOVED") {
    canvas.updateNode(nodeId, {
      x: Number(payload.x ?? 0),
      y: Number(payload.y ?? 0),
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (deltaType === "NODE_RESIZED") {
    canvas.updateNode(nodeId, {
      x: Number(payload.x ?? 0),
      y: Number(payload.y ?? 0),
      width: Number(payload.width ?? payload.w ?? 0),
      height: Number(payload.height ?? payload.h ?? 0),
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (deltaType === "NODE_TEXT_UPDATED") {
    canvas.updateNode(nodeId, {
      textContent: String(payload.textContent ?? payload.text ?? ""),
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (deltaType === "NODE_STYLE_CHANGED") {
    canvas.updateNode(nodeId, {
      style: (payload.changes ?? payload.style ?? null) as Record<string, unknown> | null,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (deltaType === "NODE_LOCKED") {
    canvas.updateNode(nodeId, {
      locked: true,
      lockedBy: (payload.lockedBy ?? null) as UUID | null,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (deltaType === "NODE_UNLOCKED") {
    canvas.updateNode(nodeId, {
      locked: false,
      lockedBy: null,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (deltaType === "NODE_Z_CHANGED") {
    canvas.updateNode(nodeId, {
      zIndex: Number(payload.zIndex ?? 0),
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (deltaType === "NODE_DELETED") {
    canvas.removeNode(nodeId);
  }
}
