import type { CanvasNode, UUID } from "../../../shared/types";
import type { Db } from "../db";

export interface RoomMemberSummary {
  userId: UUID;
  displayName: string;
  role: string;
  color: string;
}

export class RoomStateService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  getRoomNodes(roomId: UUID): CanvasNode[] {
    const stmt = this.db.prepare(
      `SELECT
         node_id, room_id, node_type, x, y, width, height, text_content, crdt_state,
         style, author_id, ai_tag, locked, locked_by, z_index, deleted_at, created_at, updated_at
       FROM canvas_nodes WHERE room_id = ? AND deleted_at IS NULL`
    );

    return stmt.all(roomId).map((row: any) => ({
      nodeId: row.node_id,
      roomId: row.room_id,
      nodeType: row.node_type,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      textContent: row.text_content,
      crdtState: row.crdt_state ? Array.from(row.crdt_state as Buffer) : null,
      style: row.style ? JSON.parse(row.style) : null,
      authorId: row.author_id,
      aiTag: row.ai_tag,
      locked: Boolean(row.locked),
      lockedBy: row.locked_by,
      zIndex: row.z_index,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getRoomMembers(roomId: UUID): RoomMemberSummary[] {
    const stmt = this.db.prepare(
      `SELECT
         rm.user_id, rm.role, u.display_name, u.cursor_color
       FROM room_members rm
       JOIN users u ON u.user_id = rm.user_id
       WHERE rm.room_id = ?`
    );

    return stmt.all(roomId).map((row: any) => ({
      userId: row.user_id,
      displayName: row.display_name,
      role: row.role,
      color: row.cursor_color,
    }));
  }
}
