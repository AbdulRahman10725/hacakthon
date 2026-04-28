import { z } from "zod";

export const wsMessageSchema = z.object({
  type: z.string(),
  roomId: z.string().uuid(),
  payload: z.unknown().optional(),
  timestamp: z.string().optional(),
  sequenceNumber: z.number().optional(),
});

export const reconnectPayloadSchema = z.object({
  lastSequenceNumber: z.number().int().nonnegative(),
});

export const cursorMovePayloadSchema = z.object({
  x: z.number(),
  y: z.number(),
  status: z.string().optional(),
});

export const canvasDeltaPayloadSchema = z.object({
  nodeId: z.string().uuid(),
  deltaType: z.enum([
    "NODE_CREATED",
    "NODE_MOVED",
    "NODE_RESIZED",
    "NODE_TEXT_UPDATED",
    "NODE_STYLE_CHANGED",
    "NODE_DELETED",
    "NODE_LOCKED",
    "NODE_UNLOCKED",
    "NODE_Z_CHANGED",
  ]),
});
