import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { CreateRoomResponse, RoomStateResponse, WsEnvelope } from "../../../../shared/protocol";
import type { Role, UUID } from "../../../../shared/types";
import { EventStore } from "../../services/EventStore";
import { RoomService } from "../../services/RoomService";
import { RoomStateService } from "../../services/RoomStateService";
import { RbacService } from "../../services/RbacService";
import { TaskService } from "../../services/TaskService";
import type { AuthedRequest } from "../middleware/auth";

const createRoomSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

const getEventsQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
});

const patchRoleSchema = z.object({
  role: z.enum(["LEAD", "CONTRIBUTOR", "VIEWER"]),
});

export function createRoomsRouter(params: {
  roomService: RoomService;
  eventStore: EventStore;
  roomStateService: RoomStateService;
  rbacService: RbacService;
  taskService: TaskService;
  broadcastToRoom?: (roomId: UUID, message: WsEnvelope) => void;
}): Router {
  const { roomService, eventStore, roomStateService, rbacService, taskService, broadcastToRoom } = params;
  const router = Router();

  router.post("/", (req: AuthedRequest, res) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const room = roomService.createRoom({
      createdBy: req.auth.userId,
      name: parsed.data.name ?? null,
    });

    const response: CreateRoomResponse = {
      roomId: room.roomId,
      shareUrl: `/room/${room.roomId}`,
    };

    return res.json(response);
  });

  router.get("/:roomId", (req: AuthedRequest, res) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const roomId = req.params.roomId as UUID;
    const room = roomService.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.json(room);
  });

  router.get("/:roomId/state", (req: AuthedRequest, res) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const roomId = req.params.roomId as UUID;
    const room = roomService.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const nodes = roomStateService.getRoomNodes(roomId);
    const members = roomStateService.getRoomMembers(roomId);

    const response: RoomStateResponse = {
      roomId,
      nodes,
      sequenceNumber: eventStore.getMaxSequence(roomId),
      members,
    };

    return res.json(response);
  });

  router.get("/:roomId/events", (req: AuthedRequest, res) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const roomId = req.params.roomId as UUID;
    const room = roomService.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const query = getEventsQuerySchema.safeParse(req.query);
    if (!query.success) {
      return res.status(400).json({ error: "Invalid query" });
    }

    const events = eventStore.getEventsSince(roomId, query.data.since);
    return res.json({
      events,
      sequenceNumber: eventStore.getMaxSequence(roomId),
    });
  });

  router.get("/:roomId/tasks", (req: AuthedRequest, res) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const roomId = req.params.roomId as UUID;
    const room = roomService.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.json({
      tasks: taskService.getTasks(roomId),
    });
  });

  router.patch("/:roomId/members/:userId", (req: AuthedRequest, res) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const roomId = req.params.roomId as UUID;
    const targetUserId = req.params.userId as UUID;
    const room = roomService.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const parsed = patchRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const currentRole = rbacService.getMemberRole(roomId, targetUserId);
    const decision = rbacService.canChangeMemberRole({
      roomId,
      actorUserId: req.auth.userId,
      targetUserId,
      nextRole: parsed.data.role,
    });

    if (!decision.allowed) {
      const status = decision.code === "MEMBER_NOT_FOUND" ? 404 : 403;
      return res.status(status).json({ error: decision.message ?? "Forbidden", code: decision.code });
    }

    rbacService.updateMemberRole(roomId, targetUserId, parsed.data.role);
    roomService.touchRoom(roomId);

    const createdAt = new Date().toISOString();
    const event = eventStore.appendEvent({
      eventId: randomUUID(),
      roomId,
      eventType: "ROLE_CHANGED",
      userId: req.auth.userId,
      payload: {
        userId: targetUserId,
        previousRole: currentRole,
        role: parsed.data.role,
      },
      createdAt,
    });

    broadcastToRoom?.(roomId, {
      type: "ROLE_UPDATE",
      roomId,
      userId: targetUserId,
      sequenceNumber: event.sequenceNumber,
      timestamp: createdAt,
      payload: {
        userId: targetUserId,
        previousRole: currentRole,
        role: parsed.data.role,
      },
    });

    return res.json({
      userId: targetUserId,
      role: parsed.data.role as Role,
    });
  });

  return router;
}
