import type WebSocket from "ws";
import type { UUID } from "../../../shared/types";
import type { ClientConnection } from "./types";

export class RoomRegistry {
  private rooms = new Map<UUID, Set<ClientConnection>>();
  private sockets = new Map<WebSocket, ClientConnection>();

  addClient(client: ClientConnection): void {
    if (!this.rooms.has(client.roomId)) {
      this.rooms.set(client.roomId, new Set());
    }
    this.rooms.get(client.roomId)!.add(client);
    this.sockets.set(client.ws, client);
  }

  removeClient(ws: WebSocket): ClientConnection | null {
    const client = this.sockets.get(ws);
    if (!client) return null;

    const roomClients = this.rooms.get(client.roomId);
    if (roomClients) {
      roomClients.delete(client);
      if (roomClients.size === 0) {
        this.rooms.delete(client.roomId);
      }
    }

    this.sockets.delete(ws);
    return client;
  }

  getClient(ws: WebSocket): ClientConnection | null {
    return this.sockets.get(ws) ?? null;
  }

  getClients(roomId: UUID): Set<ClientConnection> {
    return this.rooms.get(roomId) ?? new Set();
  }

  getRoomIds(): UUID[] {
    return Array.from(this.rooms.keys());
  }
}
