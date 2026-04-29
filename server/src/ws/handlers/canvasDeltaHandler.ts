import { randomUUID } from "crypto";
import type { WsEnvelope } from "../../../../shared/protocol";
import type { EventType, UUID } from "../../../../shared/types";
import type { AIClassifierService } from "../../services/AIClassifierService";
import type { CanvasStateService } from "../../services/CanvasStateService";
import type { EventStore } from "../../services/EventStore";
import type { RbacService } from "../../services/RbacService";
import type { RoomService } from "../../services/RoomService";
import type { TaskService } from "../../services/TaskService";
import type { ClientConnection } from "../types";

const MAX_TEXT_LENGTH = 10000;

function sanitizeText(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=\s*/gi, "")
    .trim();
}

export function handleCanvasDelta(params: {
  client: ClientConnection;
  payload: Record<string, unknown>;
  eventStore: EventStore;
  canvasState: CanvasStateService;
  rbac: RbacService;
  roomService: RoomService;
  aiClassifier: AIClassifierService;
  taskService: TaskService;
  sendToRoom: (roomId: UUID, message: WsEnvelope, exclude?: ClientConnection) => void;
  sendError: (client: ClientConnection, code: string, message: string, nodeId?: UUID) => void;
}): boolean {
  const {
    client,
    payload,
    eventStore,
    canvasState,
    rbac,
    roomService,
    aiClassifier,
    taskService,
    sendToRoom,
    sendError,
  } = params;

  const nodeId = payload.nodeId as UUID | undefined;
  const deltaType = payload.deltaType as string | undefined;

  if (!nodeId || !deltaType) {
    sendError(client, "INVALID_PAYLOAD", "Missing nodeId or deltaType");
    return false;
  }

  if (deltaType === "NODE_CREATED") {
    const hasType = Boolean(payload.nodeType ?? payload.type);
    const hasPosition = typeof payload.x === "number" && typeof payload.y === "number";
    if (!hasType || !hasPosition) {
      sendError(client, "INVALID_PAYLOAD", "Missing nodeType or position", nodeId);
      return false;
    }
  }

  if (deltaType === "NODE_MOVED") {
    const hasPosition = typeof payload.x === "number" && typeof payload.y === "number";
    if (!hasPosition) {
      sendError(client, "INVALID_PAYLOAD", "Missing position", nodeId);
      return false;
    }
  }

  if (deltaType === "NODE_RESIZED") {
    const hasWidth = typeof payload.width === "number" || typeof payload.w === "number";
    const hasHeight = typeof payload.height === "number" || typeof payload.h === "number";
    if (!hasWidth || !hasHeight) {
      sendError(client, "INVALID_PAYLOAD", "Missing size", nodeId);
      return false;
    }
  }

  if (deltaType === "NODE_TEXT_UPDATED") {
    const hasText = typeof payload.textContent === "string" || typeof payload.text === "string";
    const hasCrdt = Array.isArray(payload.crdtUpdate);
    if (!hasText && !hasCrdt) {
      sendError(client, "INVALID_PAYLOAD", "Missing text update", nodeId);
      return false;
    }
  }

  if (typeof payload.textContent === "string") {
    const sanitized = sanitizeText(payload.textContent);
    if (sanitized.length > MAX_TEXT_LENGTH) {
      sendError(client, "PAYLOAD_TOO_LARGE", "Text exceeds maximum length", nodeId);
      return false;
    }
    payload.textContent = sanitized;
  }

  if (typeof payload.text === "string") {
    const sanitized = sanitizeText(payload.text);
    if (sanitized.length > MAX_TEXT_LENGTH) {
      sendError(client, "PAYLOAD_TOO_LARGE", "Text exceeds maximum length", nodeId);
      return false;
    }
    payload.text = sanitized;
  }

  if (deltaType === "NODE_CREATED" || deltaType === "NODE_TEXT_UPDATED") {
    const textForClassification =
      typeof payload.textContent === "string"
        ? payload.textContent
        : typeof payload.text === "string"
          ? payload.text
          : "";

    if (textForClassification) {
      payload.aiTag = aiClassifier.classifyText(textForClassification);
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
    return false;
  }

  if (deltaType !== "NODE_CREATED" && !canvasState.getNode(client.roomId, nodeId)) {
    sendError(client, "NODE_NOT_FOUND", "Node not found", nodeId);
    return false;
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
  roomService.touchRoom(client.roomId);

  const envelope: WsEnvelope = {
    type: "CANVAS_DELTA",
    roomId: client.roomId,
    userId: client.userId,
    sequenceNumber: event.sequenceNumber,
    timestamp: createdAt,
    payload,
  };

  sendToRoom(client.roomId, envelope, client);

  if (payload.aiTag) {
    sendToRoom(client.roomId, {
      type: "AI_TAG_UPDATE",
      roomId: client.roomId,
      userId: client.userId,
      timestamp: createdAt,
      payload: {
        nodeId,
        tag: payload.aiTag,
      },
    });
  }

  if (payload.aiTag === "ACTION_ITEM") {
    const textContent = String(payload.textContent ?? payload.text ?? "");
    if (textContent) {
      const task = taskService.upsertTask({
        roomId: client.roomId,
        nodeId,
        textContent,
        authorId: client.userId,
      });

      eventStore.appendEvent({
        eventId: randomUUID(),
        roomId: client.roomId,
        eventType: "TASK_CREATED",
        userId: client.userId,
        payload: {
          taskId: task.taskId,
          nodeId: task.nodeId,
          textContent: task.textContent,
          status: task.status,
        },
        createdAt,
      });
    }
  }

  if (deltaType === "NODE_DELETED") {
    const task = taskService.markRemovedByNode(client.roomId, nodeId);
    if (task) {
      eventStore.appendEvent({
        eventId: randomUUID(),
        roomId: client.roomId,
        eventType: "TASK_REMOVED",
        userId: client.userId,
        payload: {
          taskId: task.taskId,
          nodeId: task.nodeId,
          status: task.status,
        },
        createdAt,
      });
    }
  }

  return true;
}
