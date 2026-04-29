import type { WsEnvelope } from "../../../../shared/protocol";
import type { EventStore } from "../../services/EventStore";
import type { RoomStateService } from "../../services/RoomStateService";
import type { ClientConnection } from "../types";

export function handleReconnect(params: {
  client: ClientConnection;
  lastSequenceNumber: number;
  eventStore: EventStore;
  roomState: RoomStateService;
  send: (client: ClientConnection, message: WsEnvelope) => void;
}): void {
  const { client, lastSequenceNumber, eventStore, roomState, send } = params;

  if (lastSequenceNumber > 0) {
    const events = eventStore.getEventsSince(client.roomId, lastSequenceNumber);
    const members = roomState.getRoomMembers(client.roomId);
    const envelope: WsEnvelope = {
      type: "REPLAY_EVENTS",
      roomId: client.roomId,
      timestamp: new Date().toISOString(),
      payload: { events, members },
    };

    send(client, envelope);
    return;
  }

  const nodes = roomState.getRoomNodes(client.roomId);
  const members = roomState.getRoomMembers(client.roomId);
  const envelope: WsEnvelope = {
    type: "FULL_STATE",
    roomId: client.roomId,
    timestamp: new Date().toISOString(),
    sequenceNumber: eventStore.getMaxSequence(client.roomId),
    payload: { nodes, members },
  };

  send(client, envelope);
}
