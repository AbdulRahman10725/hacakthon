import type WebSocket from "ws";
import type { Role, UUID } from "../../../shared/types";

export interface ClientConnection {
  ws: WebSocket;
  roomId: UUID;
  userId: UUID;
  role: Role;
  displayName: string;
  color: string;
  lastSequenceNumber: number;
  lastSeenAt: number;
  lastPongAt: number;
  connectedAt: number;
}
