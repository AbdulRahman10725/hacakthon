import type { Role, UUID } from "../../../shared/types";
import type { Db } from "../db";

export interface RbacDecision {
  allowed: boolean;
  code?: string;
  message?: string;
}

export class RbacService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  getMemberRole(roomId: UUID, userId: UUID): Role | null {
    const stmt = this.db.prepare(
      "SELECT role FROM room_members WHERE room_id = ? AND user_id = ?"
    );
    const row = stmt.get(roomId, userId) as { role: Role } | undefined;
    return row?.role ?? null;
  }

  getNodeMeta(roomId: UUID, nodeId: UUID): {
    locked: boolean;
    lockedBy: UUID | null;
    authorId: UUID | null;
  } | null {
    const stmt = this.db.prepare(
      "SELECT locked, locked_by, author_id FROM canvas_nodes WHERE room_id = ? AND node_id = ?"
    );
    const row = stmt.get(roomId, nodeId) as
      | { locked: number; locked_by: UUID | null; author_id: UUID | null }
      | undefined;

    if (!row) return null;

    return {
      locked: Boolean(row.locked),
      lockedBy: row.locked_by,
      authorId: row.author_id,
    };
  }

  canApplyDelta(params: {
    roomId: UUID;
    userId: UUID;
    role: Role;
    deltaType: string;
    nodeId?: UUID;
  }): RbacDecision {
    const { role, deltaType, nodeId, roomId, userId } = params;

    if (role === "VIEWER") {
      return { allowed: false, code: "RBAC_DENIED", message: "Viewers cannot edit" };
    }

    if (["NODE_LOCKED", "NODE_UNLOCKED"].includes(deltaType) && role !== "LEAD") {
      return { allowed: false, code: "RBAC_DENIED", message: "Lead role required" };
    }

    if (nodeId) {
      const node = this.getNodeMeta(roomId, nodeId);
      if (!node) {
        return { allowed: false, code: "NODE_NOT_FOUND", message: "Node not found" };
      }

      if (node.locked && role !== "LEAD") {
        return {
          allowed: false,
          code: "RBAC_DENIED",
          message: "Node is locked",
        };
      }

      if (deltaType === "NODE_DELETED" && role === "CONTRIBUTOR") {
        if (node.authorId !== userId) {
          return {
            allowed: false,
            code: "RBAC_DENIED",
            message: "Contributors can only delete their own nodes",
          };
        }
      }
    }

    return { allowed: true };
  }
}
