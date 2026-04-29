import type { UUID } from "../../../shared/types";
import type { Db } from "../db";

export class CanvasStateService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  getNode(roomId: UUID, nodeId: UUID): { nodeId: UUID } | null {
    const stmt = this.db.prepare(
      "SELECT node_id FROM canvas_nodes WHERE room_id = ? AND node_id = ?"
    );
    const row = stmt.get(roomId, nodeId) as { node_id: UUID } | undefined;
    return row ? { nodeId: row.node_id } : null;
  }

  applyDelta(params: {
    roomId: UUID;
    userId: UUID;
    deltaType: string;
    payload: Record<string, unknown>;
  }): void {
    const { roomId, userId, deltaType, payload } = params;
    const now = new Date().toISOString();

    if (deltaType === "NODE_CREATED") {
      const nodeId = payload.nodeId as string;
      const nodeType = (payload.nodeType ?? payload.type) as string;
      const x = Number(payload.x ?? 0);
      const y = Number(payload.y ?? 0);
      const width = payload.width ?? payload.w ?? null;
      const height = payload.height ?? payload.h ?? null;
      const textContent = (payload.textContent ?? payload.text) as string | null;
      const style = payload.style ? JSON.stringify(payload.style) : null;

      const stmt = this.db.prepare(
        `INSERT OR IGNORE INTO canvas_nodes
          (node_id, room_id, node_type, x, y, width, height, text_content,
           crdt_state, style, author_id, ai_tag, locked, locked_by, z_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const crdtState = Array.isArray(payload.crdtUpdate)
        ? Buffer.from(payload.crdtUpdate as number[])
        : null;

      stmt.run(
        nodeId,
        roomId,
        nodeType,
        x,
        y,
        width,
        height,
        textContent,
        crdtState,
        style,
        userId,
        payload.aiTag ?? null,
        0,
        null,
        payload.zIndex ?? 0,
        now,
        now
      );

      return;
    }

    if (deltaType === "NODE_MOVED") {
      const stmt = this.db.prepare(
        "UPDATE canvas_nodes SET x = ?, y = ?, updated_at = ? WHERE room_id = ? AND node_id = ?"
      );
      stmt.run(payload.x, payload.y, now, roomId, payload.nodeId);
      return;
    }

    if (deltaType === "NODE_RESIZED") {
      const stmt = this.db.prepare(
        "UPDATE canvas_nodes SET x = ?, y = ?, width = ?, height = ?, updated_at = ? WHERE room_id = ? AND node_id = ?"
      );
      stmt.run(
        payload.x,
        payload.y,
        payload.width ?? payload.w,
        payload.height ?? payload.h,
        now,
        roomId,
        payload.nodeId
      );
      return;
    }

    if (deltaType === "NODE_TEXT_UPDATED") {
      const stmt = this.db.prepare(
        "UPDATE canvas_nodes SET text_content = ?, crdt_state = ?, ai_tag = ?, updated_at = ? WHERE room_id = ? AND node_id = ?"
      );
      const crdtState = Array.isArray(payload.crdtUpdate)
        ? Buffer.from(payload.crdtUpdate as number[])
        : null;
      stmt.run(
        payload.textContent ?? payload.text ?? null,
        crdtState,
        payload.aiTag ?? null,
        now,
        roomId,
        payload.nodeId
      );
      return;
    }

    if (deltaType === "NODE_STYLE_CHANGED") {
      const stmt = this.db.prepare(
        "UPDATE canvas_nodes SET style = ?, ai_tag = COALESCE(?, ai_tag), updated_at = ? WHERE room_id = ? AND node_id = ?"
      );
      const style = payload.changes ? JSON.stringify(payload.changes) : payload.style ? JSON.stringify(payload.style) : null;
      stmt.run(style, payload.aiTag ?? null, now, roomId, payload.nodeId);
      return;
    }

    if (deltaType === "NODE_DELETED") {
      const stmt = this.db.prepare(
        "UPDATE canvas_nodes SET deleted_at = ?, updated_at = ? WHERE room_id = ? AND node_id = ?"
      );
      stmt.run(now, now, roomId, payload.nodeId);
      return;
    }

    if (deltaType === "NODE_LOCKED") {
      const stmt = this.db.prepare(
        "UPDATE canvas_nodes SET locked = 1, locked_by = ?, updated_at = ? WHERE room_id = ? AND node_id = ?"
      );
      stmt.run(userId, now, roomId, payload.nodeId);
      return;
    }

    if (deltaType === "NODE_UNLOCKED") {
      const stmt = this.db.prepare(
        "UPDATE canvas_nodes SET locked = 0, locked_by = NULL, updated_at = ? WHERE room_id = ? AND node_id = ?"
      );
      stmt.run(now, roomId, payload.nodeId);
      return;
    }

    if (deltaType === "NODE_Z_CHANGED") {
      const stmt = this.db.prepare(
        "UPDATE canvas_nodes SET z_index = ?, updated_at = ? WHERE room_id = ? AND node_id = ?"
      );
      stmt.run(payload.zIndex ?? 0, now, roomId, payload.nodeId);
    }
  }
}
