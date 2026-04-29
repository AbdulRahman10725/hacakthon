import { randomUUID } from "crypto";
import type { TaskEntry, UUID } from "../../../shared/types";
import type { Db } from "../db";

export class TaskService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  getTasks(roomId: UUID): TaskEntry[] {
    const stmt = this.db.prepare(
      `SELECT task_id, room_id, node_id, text_content, author_id, status, created_at
       FROM tasks WHERE room_id = ? ORDER BY created_at ASC`
    );

    return stmt.all(roomId).map((row: any) => ({
      taskId: row.task_id,
      roomId: row.room_id,
      nodeId: row.node_id,
      textContent: row.text_content,
      authorId: row.author_id,
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  findByNode(roomId: UUID, nodeId: UUID): TaskEntry | null {
    const row = this.db
      .prepare(
        `SELECT task_id, room_id, node_id, text_content, author_id, status, created_at
         FROM tasks WHERE room_id = ? AND node_id = ? LIMIT 1`
      )
      .get(roomId, nodeId) as any;

    if (!row) return null;

    return {
      taskId: row.task_id,
      roomId: row.room_id,
      nodeId: row.node_id,
      textContent: row.text_content,
      authorId: row.author_id,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  upsertTask(params: {
    roomId: UUID;
    nodeId: UUID;
    textContent: string;
    authorId: UUID | null;
  }): TaskEntry {
    const existing = this.findByNode(params.roomId, params.nodeId);
    if (existing) {
      this.db
        .prepare(
          `UPDATE tasks
           SET text_content = ?, author_id = ?, status = 'ACTIVE'
           WHERE task_id = ?`
        )
        .run(params.textContent, params.authorId, existing.taskId);

      return {
        ...existing,
        textContent: params.textContent,
        authorId: params.authorId,
        status: "ACTIVE",
      };
    }

    const taskId = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO tasks (task_id, room_id, node_id, text_content, author_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`
      )
      .run(taskId, params.roomId, params.nodeId, params.textContent, params.authorId, createdAt);

    return {
      taskId,
      roomId: params.roomId,
      nodeId: params.nodeId,
      textContent: params.textContent,
      authorId: params.authorId,
      status: "ACTIVE",
      createdAt,
    };
  }

  markRemovedByNode(roomId: UUID, nodeId: UUID): TaskEntry | null {
    const existing = this.findByNode(roomId, nodeId);
    if (!existing) return null;

    this.db
      .prepare("UPDATE tasks SET status = 'REMOVED' WHERE task_id = ?")
      .run(existing.taskId);

    return {
      ...existing,
      status: "REMOVED",
    };
  }
}
