import type { Router } from "express";
import { z } from "zod";
import type { CreateRoomResponse, RoomStateResponse } from "../../../shared/protocol";
import type { UUID } from "../../../shared/types";
import { EventStore } from "../../services/EventStore";
import { RoomService } from "../../services/RoomService";
import { RoomStateService } from "../../services/RoomStateService";
import type { AuthedRequest } from "../middleware/auth";

const createRoomSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export function createRoomsRouter(params: {
  roomService: RoomService;
  eventStore: EventStore;
  roomStateService: RoomStateService;
}): Router {
  const { roomService, eventStore, roomStateService } = params;
  const router = require("express").Router();

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

  return router;
}
