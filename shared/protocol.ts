import type { CanvasNode, CanvasEvent, Role, UUID } from "./types";

export type WsMessageType =
  | "RECONNECT"
  | "FULL_STATE"
  | "REPLAY_EVENTS"
  | "CANVAS_DELTA"
  | "CURSOR_MOVE"
  | "USER_JOINED"
  | "USER_LEFT"
  | "ROLE_UPDATE"
  | "AI_TAG_UPDATE"
  | "PING"
  | "PONG"
  | "ERROR";

export interface WsEnvelope<T = Record<string, unknown>> {
  type: WsMessageType;
  roomId: UUID;
  userId?: UUID;
  sequenceNumber?: number;
  timestamp: string;
  payload: T;
}

export interface AuthJoinRequest {
  displayName: string;
  roomId?: UUID;
  role?: Role;
}

export interface AuthJoinResponse {
  userId: UUID;
  displayName: string;
  role: Role;
  token: string;
  color: string;
  roomId: UUID;
}

export interface CreateRoomResponse {
  roomId: UUID;
  shareUrl: string;
}

export interface RoomStateResponse {
  roomId: UUID;
  nodes: CanvasNode[];
  sequenceNumber: number;
  members: Array<{ userId: UUID; displayName: string; role: Role; color: string }>;
}

export interface ReplayEventsPayload {
  events: CanvasEvent[];
}
