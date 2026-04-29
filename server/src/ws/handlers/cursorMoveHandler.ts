import type { WsEnvelope } from "../../../../shared/protocol";
import type { UUID } from "../../../../shared/types";
import type { ClientConnection } from "../types";

export function handleCursorMove(params: {
  client: ClientConnection;
  payload: Record<string, unknown>;
  sendToRoom: (roomId: UUID, message: WsEnvelope, exclude?: ClientConnection) => void;
}): void {
  const { client, payload, sendToRoom } = params;

  const envelope: WsEnvelope = {
    type: "CURSOR_MOVE",
    roomId: client.roomId,
    userId: client.userId,
    timestamp: new Date().toISOString(),
    payload: {
      ...payload,
      displayName: client.displayName,
      color: client.color,
    },
  };

  sendToRoom(client.roomId, envelope, client);
}
