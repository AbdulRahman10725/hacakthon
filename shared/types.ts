export type UUID = string;

export type Role = "LEAD" | "CONTRIBUTOR" | "VIEWER";

export interface Room {
  roomId: UUID;
  name: string | null;
  createdBy: UUID;
  createdAt: string;
  lastActive: string;
}

export interface User {
  userId: UUID;
  displayName: string;
  cursorColor: string;
  createdAt: string;
}

export interface RoomMember {
  roomId: UUID;
  userId: UUID;
  role: Role;
  joinedAt: string;
}

export interface JwtPayload {
  userId: UUID;
  roomId: UUID;
  role: Role;
  displayName: string;
  color: string;
  iat: number;
  exp: number;
}

export type EventType =
  | "NODE_CREATED"
  | "NODE_MOVED"
  | "NODE_RESIZED"
  | "NODE_TEXT_UPDATED"
  | "NODE_STYLE_CHANGED"
  | "NODE_DELETED"
  | "NODE_LOCKED"
  | "NODE_UNLOCKED"
  | "NODE_Z_CHANGED"
  | "TASK_CREATED"
  | "TASK_REMOVED"
  | "ROLE_CHANGED"
  | "USER_JOINED"
  | "USER_LEFT";

export interface CanvasEvent {
  sequenceNumber: number;
  eventId: UUID;
  roomId: UUID;
  eventType: EventType;
  userId: UUID | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CanvasNode {
  nodeId: UUID;
  roomId: UUID;
  nodeType: string;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  textContent: string | null;
  crdtState: number[] | null;
  style: Record<string, unknown> | null;
  authorId: UUID | null;
  aiTag: string | null;
  locked: boolean;
  lockedBy: UUID | null;
  zIndex: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEntry {
  taskId: UUID;
  roomId: UUID;
  nodeId: UUID;
  textContent: string;
  authorId: UUID | null;
  status: "ACTIVE" | "REMOVED";
  createdAt: string;
}
