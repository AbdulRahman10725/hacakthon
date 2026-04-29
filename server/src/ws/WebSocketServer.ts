import http from "http";
import { randomUUID } from "crypto";
import WebSocket, { WebSocketServer as WSS } from "ws";
import jwt from "jsonwebtoken";
import type { WsEnvelope } from "../../../shared/protocol";
import type { JwtPayload, UUID } from "../../../shared/types";
import type { AIClassifierService } from "../services/AIClassifierService";
import type { CanvasStateService } from "../services/CanvasStateService";
import type { EventStore } from "../services/EventStore";
import type { RbacService } from "../services/RbacService";
import type { RoomService } from "../services/RoomService";
import type { RoomStateService } from "../services/RoomStateService";
import type { TaskService } from "../services/TaskService";
import { RoomRegistry } from "./RoomRegistry";
import type { ClientConnection } from "./types";
import {
  canvasDeltaPayloadSchema,
  cursorMovePayloadSchema,
  reconnectPayloadSchema,
  wsMessageSchema,
} from "./MessageSchemas";
import { handleCanvasDelta } from "./handlers/canvasDeltaHandler";
import { handleCursorMove } from "./handlers/cursorMoveHandler";
import { handleReconnect } from "./handlers/reconnectHandler";

const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 15000;

export class WebSocketServer {
  private wss: WSS;
  private registry = new RoomRegistry();
  private eventStore: EventStore;
  private roomService: RoomService;
  private roomState: RoomStateService;
  private rbac: RbacService;
  private canvasState: CanvasStateService;
  private aiClassifier: AIClassifierService;
  private taskService: TaskService;
  private jwtSecret: string;
  private heartbeatTimer: NodeJS.Timeout;
  private eventsProcessed = 0;

  constructor(params: {
    server: http.Server;
    jwtSecret: string;
    eventStore: EventStore;
    roomService: RoomService;
    roomState: RoomStateService;
    rbac: RbacService;
    canvasState: CanvasStateService;
    aiClassifier: AIClassifierService;
    taskService: TaskService;
  }) {
    this.wss = new WSS({ noServer: true });
    this.jwtSecret = params.jwtSecret;
    this.eventStore = params.eventStore;
    this.roomService = params.roomService;
    this.roomState = params.roomState;
    this.rbac = params.rbac;
    this.canvasState = params.canvasState;
    this.aiClassifier = params.aiClassifier;
    this.taskService = params.taskService;

    params.server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url ?? "", `http://${request.headers.host}`);
      if (url.pathname !== "/ws") {
        socket.destroy();
        return;
      }

      const token = url.searchParams.get("token");
      const roomId = url.searchParams.get("roomId");

      if (!token || !roomId) {
        socket.destroy();
        return;
      }

      let payload: JwtPayload;
      try {
        payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      } catch {
        socket.destroy();
        return;
      }

      if (payload.roomId !== roomId) {
        socket.destroy();
        return;
      }

      const room = this.roomService.getRoom(roomId);
      const memberRole = this.rbac.getMemberRole(roomId, payload.userId);
      if (!room || !memberRole) {
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.handleConnection(ws, {
          ...payload,
          role: memberRole,
        });
      });
    });

    this.heartbeatTimer = setInterval(() => this.runHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  getMetrics(): { activeRooms: number; activeConnections: number; eventsProcessed: number } {
    return {
      activeRooms: this.registry.getRoomIds().length,
      activeConnections: this.registry.getConnectionCount(),
      eventsProcessed: this.eventsProcessed,
    };
  }

  broadcastToRoom(roomId: UUID, message: WsEnvelope, exclude?: ClientConnection): void {
    this.sendToRoom(roomId, message, exclude);
  }

  close(): void {
    clearInterval(this.heartbeatTimer);
    for (const roomId of this.registry.getRoomIds()) {
      const clients = this.registry.getClients(roomId);
      for (const client of clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(1012, "Server restart");
        }
      }
    }
    this.wss.close();
  }

  private handleConnection(ws: WebSocket, payload: JwtPayload): void {
    const now = Date.now();
    const memberRole = this.rbac.getMemberRole(payload.roomId, payload.userId);
    if (!memberRole) {
      ws.close();
      return;
    }

    const client: ClientConnection = {
      ws,
      roomId: payload.roomId,
      userId: payload.userId,
      role: memberRole,
      displayName: payload.displayName,
      color: payload.color,
      lastSequenceNumber: 0,
      lastSeenAt: now,
      lastPongAt: now,
      connectedAt: now,
    };

    this.registry.addClient(client);

    const joinedAt = new Date().toISOString();
    let joinSequenceNumber: number | undefined;
    try {
      const joinEvent = this.eventStore.appendEvent({
        eventId: randomUUID(),
        roomId: client.roomId,
        eventType: "USER_JOINED",
        userId: client.userId,
        payload: {
          userId: client.userId,
          displayName: client.displayName,
          role: client.role,
          color: client.color,
        },
        createdAt: joinedAt,
      });
      joinSequenceNumber = joinEvent.sequenceNumber;
    } catch {
      joinSequenceNumber = undefined;
    }

    this.sendToRoom(
      client.roomId,
      {
        type: "USER_JOINED",
        roomId: client.roomId,
        userId: client.userId,
        sequenceNumber: joinSequenceNumber,
        timestamp: joinedAt,
        payload: {
          userId: client.userId,
          displayName: client.displayName,
          role: client.role,
          color: client.color,
        },
      },
      client
    );

    ws.on("message", (raw) => this.handleMessage(client, raw.toString()));

    ws.on("close", () => {
      this.registry.removeClient(ws);
      this.promoteContributorIfNeeded(client);

      const leftAt = new Date().toISOString();
      let leaveSequenceNumber: number | undefined;
      try {
        const leaveEvent = this.eventStore.appendEvent({
          eventId: randomUUID(),
          roomId: client.roomId,
          eventType: "USER_LEFT",
          userId: client.userId,
          payload: { userId: client.userId },
          createdAt: leftAt,
        });
        leaveSequenceNumber = leaveEvent.sequenceNumber;
      } catch {
        leaveSequenceNumber = undefined;
      }

      this.sendToRoom(
        client.roomId,
        {
          type: "USER_LEFT",
          roomId: client.roomId,
          userId: client.userId,
          sequenceNumber: leaveSequenceNumber,
          timestamp: leftAt,
          payload: { userId: client.userId },
        },
        client
      );
    });
  }

  private promoteContributorIfNeeded(departedClient: ClientConnection): void {
    if (departedClient.role !== "LEAD") {
      return;
    }

    const remainingClients = Array.from(this.registry.getClients(departedClient.roomId));
    if (remainingClients.some((client) => client.role === "LEAD")) {
      return;
    }

    const candidate = remainingClients
      .filter((client) => client.role === "CONTRIBUTOR")
      .sort((a, b) => a.connectedAt - b.connectedAt)[0];

    if (!candidate) {
      return;
    }

    candidate.role = "LEAD";
    this.rbac.updateMemberRole(candidate.roomId, candidate.userId, "LEAD");
    const createdAt = new Date().toISOString();
    const roleEvent = this.eventStore.appendEvent({
      eventId: randomUUID(),
      roomId: candidate.roomId,
      eventType: "ROLE_CHANGED",
      userId: candidate.userId,
      payload: {
        userId: candidate.userId,
        previousRole: "CONTRIBUTOR",
        role: "LEAD",
      },
      createdAt,
    });

    this.sendToRoom(candidate.roomId, {
      type: "ROLE_UPDATE",
      roomId: candidate.roomId,
      userId: candidate.userId,
      sequenceNumber: roleEvent.sequenceNumber,
      timestamp: createdAt,
      payload: {
        userId: candidate.userId,
        previousRole: "CONTRIBUTOR",
        role: "LEAD",
      },
    });
  }

  private handleMessage(client: ClientConnection, raw: string): void {
    client.lastSeenAt = Date.now();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.sendError(client, "INVALID_PAYLOAD", "Message must be valid JSON");
      return;
    }

    const baseResult = wsMessageSchema.safeParse(parsed);
    if (!baseResult.success) {
      this.sendError(client, "INVALID_PAYLOAD", "Invalid message envelope");
      return;
    }

    const message = baseResult.data;
    if (message.roomId !== client.roomId) {
      this.sendError(client, "INVALID_PAYLOAD", "Room mismatch");
      return;
    }

    switch (message.type) {
      case "RECONNECT": {
        const result = reconnectPayloadSchema.safeParse(message.payload);
        if (!result.success) {
          this.sendError(client, "INVALID_PAYLOAD", "Invalid reconnect payload");
          return;
        }

        client.lastSequenceNumber = result.data.lastSequenceNumber;
        handleReconnect({
          client,
          lastSequenceNumber: result.data.lastSequenceNumber,
          eventStore: this.eventStore,
          roomState: this.roomState,
          send: this.sendToClient.bind(this),
        });
        return;
      }
      case "CANVAS_DELTA": {
        const result = canvasDeltaPayloadSchema.safeParse(message.payload);
        if (!result.success) {
          this.sendError(client, "INVALID_PAYLOAD", "Invalid canvas delta payload");
          return;
        }

        const processed = handleCanvasDelta({
          client,
          payload: message.payload as Record<string, unknown>,
          eventStore: this.eventStore,
          canvasState: this.canvasState,
          rbac: this.rbac,
          roomService: this.roomService,
          aiClassifier: this.aiClassifier,
          taskService: this.taskService,
          sendToRoom: this.sendToRoom.bind(this),
          sendError: this.sendError.bind(this),
        });

        if (processed) {
          this.eventsProcessed += 1;
        }
        return;
      }
      case "CURSOR_MOVE": {
        const result = cursorMovePayloadSchema.safeParse(message.payload);
        if (!result.success) {
          this.sendError(client, "INVALID_PAYLOAD", "Invalid cursor payload");
          return;
        }

        handleCursorMove({
          client,
          payload: message.payload as Record<string, unknown>,
          sendToRoom: this.sendToRoom.bind(this),
        });
        return;
      }
      case "PING": {
        this.sendToClient(client, {
          type: "PONG",
          roomId: client.roomId,
          timestamp: new Date().toISOString(),
          payload: {},
        });
        return;
      }
      case "PONG": {
        client.lastPongAt = Date.now();
        return;
      }
      default:
        this.sendError(client, "INVALID_TYPE", "Unsupported message type");
    }
  }

  private sendToClient(client: ClientConnection, message: WsEnvelope): void {
    if (client.ws.readyState !== WebSocket.OPEN) return;
    client.ws.send(JSON.stringify(message));
  }

  private sendToRoom(roomId: UUID, message: WsEnvelope, exclude?: ClientConnection): void {
    const clients = this.registry.getClients(roomId);
    for (const client of clients) {
      if (exclude && client === exclude) continue;
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      client.ws.send(JSON.stringify(message));
    }
  }

  private sendError(
    client: ClientConnection,
    code: string,
    message: string,
    nodeId?: UUID
  ): void {
    const payload: Record<string, unknown> = { code, message };
    if (nodeId) payload.nodeId = nodeId;

    this.sendToClient(client, {
      type: "ERROR",
      roomId: client.roomId,
      timestamp: new Date().toISOString(),
      payload,
    });
  }

  private runHeartbeat(): void {
    const now = Date.now();
    for (const roomId of this.registry.getRoomIds()) {
      const clients = this.registry.getClients(roomId);
      for (const client of clients) {
        if (now - client.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
          client.ws.terminate();
          continue;
        }

        this.sendToClient(client, {
          type: "PING",
          roomId: client.roomId,
          timestamp: new Date().toISOString(),
          payload: {},
        });
      }
    }
  }
}
