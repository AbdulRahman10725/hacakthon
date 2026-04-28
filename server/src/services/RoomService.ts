import { randomUUID } from "crypto";
import type { Room, UUID } from "../../../shared/types";
import type { Db } from "../db";

export class RoomService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  createRoom(params: { createdBy: UUID; name?: string | null }): Room {
    const roomId = randomUUID();
    const now = new Date().toISOString();
    const name = params.name ?? null;

    const stmt = this.db.prepare(
      `INSERT INTO rooms (room_id, name, created_by, created_at, last_active)
       VALUES (?, ?, ?, ?, ?)`
    );

    stmt.run(roomId, name, params.createdBy, now, now);

    return {
      roomId,
      name,
      createdBy: params.createdBy,
      createdAt: now,
      lastActive: now,
    };
  }

  getRoom(roomId: UUID): Room | null {
    const stmt = this.db.prepare(
      `SELECT room_id, name, created_by, created_at, last_active FROM rooms WHERE room_id = ?`
    );
    const row = stmt.get(roomId) as
      | {
          room_id: string;
          name: string | null;
          created_by: string;
          created_at: string;
          last_active: string;
        }
      | undefined;

    if (!row) return null;

    return {
      roomId: row.room_id,
      name: row.name,
      createdBy: row.created_by,
      createdAt: row.created_at,
      lastActive: row.last_active,
    };
  }

  touchRoom(roomId: UUID): void {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE rooms SET last_active = ? WHERE room_id = ?")
      .run(now, roomId);
  }
}
