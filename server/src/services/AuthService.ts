import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import type { AuthJoinResponse } from "../../../shared/protocol";
import type { Role, UUID } from "../../../shared/types";
import type { Db } from "../db";

const CURSOR_COLORS = [
  "#E53E3E",
  "#DD6B20",
  "#D69E2E",
  "#38A169",
  "#2B6CB0",
  "#553C9A",
  "#B83280",
  "#00B5D8",
  "#2C7A7B",
  "#744210",
];

export interface AuthIdentity {
  userId: UUID;
  displayName: string;
  color: string;
}

export class AuthService {
  private db: Db;
  private jwtSecret: string;

  constructor(db: Db, jwtSecret: string) {
    this.db = db;
    this.jwtSecret = jwtSecret;
  }

  createUser(displayName: string): AuthIdentity {
    const userId = randomUUID();
    const color = this.assignColor();
    const now = new Date().toISOString();

    const insertUser = this.db.prepare(
      `INSERT INTO users (user_id, display_name, cursor_color, created_at)
       VALUES (?, ?, ?, ?)`
    );

    insertUser.run(userId, displayName, color, now);

    return {
      userId,
      displayName,
      color,
    };
  }

  addUserToRoom(params: {
    userId: UUID;
    displayName: string;
    color: string;
    roomId: UUID;
    role: Role;
  }): AuthJoinResponse {
    const now = new Date().toISOString();

    const insertMember = this.db.prepare(
      `INSERT INTO room_members (room_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)`
    );

    insertMember.run(params.roomId, params.userId, params.role, now);

    const token = jwt.sign(
      {
        userId: params.userId,
        roomId: params.roomId,
        role: params.role,
        displayName: params.displayName,
        color: params.color,
      },
      this.jwtSecret,
      { expiresIn: "1h" }
    );

    return {
      userId: params.userId,
      displayName: params.displayName,
      role: params.role,
      token,
      color: params.color,
      roomId: params.roomId,
    };
  }

  joinRoom(params: {
    displayName: string;
    roomId: UUID;
    role: Role;
  }): AuthJoinResponse {
    const identity = this.createUser(params.displayName);
    return this.addUserToRoom({
      userId: identity.userId,
      displayName: identity.displayName,
      color: identity.color,
      roomId: params.roomId,
      role: params.role,
    });
  }

  private assignColor(): string {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM users")
      .get() as { count: number };

    const index = row.count % CURSOR_COLORS.length;
    return CURSOR_COLORS[index];
  }
}
