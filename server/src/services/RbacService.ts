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

  updateMemberRole(roomId: UUID, userId: UUID, role: Role): void {
    this.db
      .prepare("UPDATE room_members SET role = ? WHERE room_id = ? AND user_id = ?")
      .run(role, roomId, userId);
  }

  countMembersWithRole(roomId: UUID, role: Role): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM room_members WHERE room_id = ? AND role = ?")
      .get(roomId, role) as { count: number };
    return row.count;
  }

  canChangeMemberRole(params: {
    roomId: UUID;
    actorUserId: UUID;
    targetUserId: UUID;
    nextRole: Role;
  }): RbacDecision {
    const actorRole = this.getMemberRole(params.roomId, params.actorUserId);
    if (actorRole !== "LEAD") {
      return { allowed: false, code: "RBAC_DENIED", message: "Lead role required" };
    }

    const currentRole = this.getMemberRole(params.roomId, params.targetUserId);
    if (!currentRole) {
      return { allowed: false, code: "MEMBER_NOT_FOUND", message: "Member not found" };
    }

    if (currentRole === params.nextRole) {
      return { allowed: true };
    }

    if (currentRole === "VIEWER" && params.nextRole === "LEAD") {
      return {
        allowed: false,
        code: "RBAC_DENIED",
        message: "Viewer cannot be promoted directly to Lead",
      };
    }

    if (currentRole === "LEAD" && params.nextRole !== "LEAD") {
      const leadCount = this.countMembersWithRole(params.roomId, "LEAD");
      if (leadCount <= 1) {
        return {
          allowed: false,
          code: "RBAC_DENIED",
          message: "At least one Lead must remain in the room",
        };
      }
    }

    return { allowed: true };
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
