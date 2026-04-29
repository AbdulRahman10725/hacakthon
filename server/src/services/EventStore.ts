import type { CanvasEvent, EventType, UUID } from "../../../shared/types";
import type { Db } from "../db";

export class EventStore {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  appendEvent(params: {
    eventId: UUID;
    roomId: UUID;
    eventType: EventType;
    userId?: UUID | null;
    payload: Record<string, unknown>;
    createdAt: string;
  }): CanvasEvent {
    const stmt = this.db.prepare(
      `INSERT INTO events (event_id, room_id, event_type, user_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const payloadJson = JSON.stringify(params.payload);
    const result = stmt.run(
      params.eventId,
      params.roomId,
      params.eventType,
      params.userId ?? null,
      payloadJson,
      params.createdAt
    );

    const sequenceNumber = Number(result.lastInsertRowid);

    return {
      sequenceNumber,
      eventId: params.eventId,
      roomId: params.roomId,
      eventType: params.eventType,
      userId: params.userId ?? null,
      payload: params.payload,
      createdAt: params.createdAt,
    };
  }

  getEventsSince(roomId: UUID, sequenceNumber: number): CanvasEvent[] {
    const stmt = this.db.prepare(
      `SELECT sequence_number, event_id, room_id, event_type, user_id, payload, created_at
       FROM events WHERE room_id = ? AND sequence_number > ? ORDER BY sequence_number ASC`
    );

    return stmt.all(roomId, sequenceNumber).map((row: any) => ({
      sequenceNumber: row.sequence_number as number,
      eventId: row.event_id as UUID,
      roomId: row.room_id as UUID,
      eventType: row.event_type as EventType,
      userId: row.user_id as UUID | null,
      payload: JSON.parse(row.payload as string) as Record<string, unknown>,
      createdAt: row.created_at as string,
    }));
  }

  getMaxSequence(roomId: UUID): number {
    const stmt = this.db.prepare(
      "SELECT MAX(sequence_number) as max_seq FROM events WHERE room_id = ?"
    );
    const row = stmt.get(roomId) as { max_seq: number | null };
    return row?.max_seq ?? 0;
  }
}
