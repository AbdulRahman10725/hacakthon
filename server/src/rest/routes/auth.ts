import type { Router } from "express";
import { z } from "zod";
import type { AuthJoinResponse } from "../../../shared/protocol";
import type { Role } from "../../../shared/types";
import { AuthService } from "../../services/AuthService";
import { RoomService } from "../../services/RoomService";

const joinSchema = z.object({
  displayName: z.string().min(1).max(100),
  roomId: z.string().uuid().optional(),
  role: z.enum(["LEAD", "CONTRIBUTOR", "VIEWER"]).optional(),
});

export function createAuthRouter(params: {
  authService: AuthService;
  roomService: RoomService;
}): Router {
  const { authService, roomService } = params;
  const router = require("express").Router();

  router.post("/join", (req, res) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const { displayName, roomId, role } = parsed.data;

    if (roomId) {
      const room = roomService.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      const assignedRole: Role = role ?? "CONTRIBUTOR";
      const response: AuthJoinResponse = authService.joinRoom({
        displayName,
        roomId,
        role: assignedRole,
      });
      return res.json(response);
    }

    const createdRoom = roomService.createRoom({ createdBy: "system" });
    const response: AuthJoinResponse = authService.joinRoom({
      displayName,
      roomId: createdRoom.roomId,
      role: "LEAD",
    });

    return res.json(response);
  });

  return router;
}
