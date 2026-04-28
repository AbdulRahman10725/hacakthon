-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  room_id     TEXT PRIMARY KEY,
  name        TEXT,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  last_active TEXT NOT NULL
);

-- Users (session-scoped)
CREATE TABLE IF NOT EXISTS users (
  user_id      TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  cursor_color TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

-- Room memberships
CREATE TABLE IF NOT EXISTS room_members (
  room_id   TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  role      TEXT NOT NULL CHECK (role IN ('LEAD','CONTRIBUTOR','VIEWER')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Append-only event log
CREATE TABLE IF NOT EXISTS events (
  sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id        TEXT NOT NULL UNIQUE,
  room_id         TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  user_id         TEXT,
  payload         TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);
CREATE INDEX IF NOT EXISTS idx_events_room_seq ON events(room_id, sequence_number);

-- Current node state cache (materialized)
CREATE TABLE IF NOT EXISTS canvas_nodes (
  node_id      TEXT PRIMARY KEY,
  room_id      TEXT NOT NULL,
  node_type    TEXT NOT NULL,
  x            REAL NOT NULL,
  y            REAL NOT NULL,
  width        REAL,
  height       REAL,
  text_content TEXT,
  crdt_state   BLOB,
  style        TEXT,
  author_id    TEXT,
  ai_tag       TEXT,
  locked       INTEGER NOT NULL DEFAULT 0,
  locked_by    TEXT,
  z_index      INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);
CREATE INDEX IF NOT EXISTS idx_nodes_room ON canvas_nodes(room_id, deleted_at);

-- Task Board entries
CREATE TABLE IF NOT EXISTS tasks (
  task_id      TEXT PRIMARY KEY,
  room_id      TEXT NOT NULL,
  node_id      TEXT NOT NULL,
  text_content TEXT NOT NULL,
  author_id    TEXT,
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at   TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);
