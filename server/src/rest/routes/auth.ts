import { Router } from "express";
import { z } from "zod";
import type { AuthJoinResponse } from "../../../../shared/protocol";
import type { Role } from "../../../../shared/types";
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
  const router = Router();

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

      const identity = authService.createUser(displayName);
      const assignedRole: Role = role === "VIEWER" ? "VIEWER" : "CONTRIBUTOR";
      const response: AuthJoinResponse = authService.addUserToRoom({
        userId: identity.userId,
        displayName: identity.displayName,
        color: identity.color,
        roomId,
        role: assignedRole,
      });
      return res.json(response);
    }

    const identity = authService.createUser(displayName);
    const createdRoom = roomService.createRoom({ createdBy: identity.userId });
    const response: AuthJoinResponse = authService.addUserToRoom({
      userId: identity.userId,
      displayName: identity.displayName,
      color: identity.color,
      roomId: createdRoom.roomId,
      role: "LEAD",
    });

    return res.json(response);
  });

  return router;
}
