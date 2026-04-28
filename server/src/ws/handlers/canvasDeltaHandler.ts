import { randomUUID } from "crypto";
import type { WsEnvelope } from "../../../../shared/protocol";
import type { EventType, UUID } from "../../../../shared/types";
import type { CanvasStateService } from "../../services/CanvasStateService";
import type { EventStore } from "../../services/EventStore";
import type { RbacService } from "../../services/RbacService";
import type { ClientConnection } from "../types";

export function handleCanvasDelta(params: {
  client: ClientConnection;
  payload: Record<string, unknown>;
  eventStore: EventStore;
  canvasState: CanvasStateService;
  rbac: RbacService;
  sendToRoom: (roomId: UUID, message: WsEnvelope, exclude?: ClientConnection) => void;
  sendError: (client: ClientConnection, code: string, message: string, nodeId?: UUID) => void;
}): void {
  const { client, payload, eventStore, canvasState, rbac, sendToRoom, sendError } = params;

  const nodeId = payload.nodeId as UUID | undefined;
  const deltaType = payload.deltaType as string | undefined;

  if (!nodeId || !deltaType) {
    sendError(client, "INVALID_PAYLOAD", "Missing nodeId or deltaType");
    return;
  }

  if (deltaType === "NODE_CREATED") {
    const hasType = Boolean(payload.nodeType ?? payload.type);
    const hasPosition = typeof payload.x === "number" && typeof payload.y === "number";
    if (!hasType || !hasPosition) {
      sendError(client, "INVALID_PAYLOAD", "Missing nodeType or position", nodeId);
      return;
    }
  }

  if (deltaType === "NODE_MOVED") {
    const hasPosition = typeof payload.x === "number" && typeof payload.y === "number";
    if (!hasPosition) {
      sendError(client, "INVALID_PAYLOAD", "Missing position", nodeId);
      return;
    }
  }

  if (deltaType === "NODE_RESIZED") {
    const hasSize =
      typeof payload.width === "number" || typeof payload.w === "number";
    const hasHeight =
      typeof payload.height === "number" || typeof payload.h === "number";
    if (!hasSize || !hasHeight) {
      sendError(client, "INVALID_PAYLOAD", "Missing size", nodeId);
      return;
    }
  }

  if (deltaType === "NODE_TEXT_UPDATED") {
    const hasText = typeof payload.textContent === "string" || typeof payload.text === "string";
    const hasCrdt = Array.isArray(payload.crdtUpdate);
    if (!hasText && !hasCrdt) {
      sendError(client, "INVALID_PAYLOAD", "Missing text update", nodeId);
      return;
    }
  }

  const decision = rbac.canApplyDelta({
    roomId: client.roomId,
    userId: client.userId,
    role: client.role,
    deltaType,
    nodeId,
  });

  if (!decision.allowed) {
    sendError(client, decision.code ?? "RBAC_DENIED", decision.message ?? "Denied", nodeId);
    return;
  }

  if (deltaType !== "NODE_CREATED" && !canvasState.getNode(client.roomId, nodeId)) {
    sendError(client, "NODE_NOT_FOUND", "Node not found", nodeId);
    return;
  }

  const createdAt = new Date().toISOString();
  const event = eventStore.appendEvent({
    eventId: randomUUID(),
    roomId: client.roomId,
    eventType: deltaType as EventType,
    userId: client.userId,
    payload,
    createdAt,
  });

  canvasState.applyDelta({
    roomId: client.roomId,
    userId: client.userId,
    deltaType,
    payload,
  });

  const envelope: WsEnvelope = {
    type: "CANVAS_DELTA",
    roomId: client.roomId,
    userId: client.userId,
    sequenceNumber: event.sequenceNumber,
    timestamp: createdAt,
    payload,
  };

  sendToRoom(client.roomId, envelope, client);
}
