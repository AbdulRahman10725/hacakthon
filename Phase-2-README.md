# Phase 2 - Real-Time WebSocket Layer

This document covers the Phase 2 implementation: the real-time WebSocket layer for LIGMA.

## What Was Implemented

- Custom WebSocket handshake with JWT verification
- Room registry and connection management
- Real-time delta broadcasting (excluding origin client)
- Sequence number handling based on append-only events
- Event replay on reconnect using last known sequence number
- Heartbeat ping/pong handling and stale connection cleanup
- Server-side RBAC enforcement before event append
- WebSocket message envelope handling and protocol validation
- Error handling for invalid payloads and unauthorized operations
- Integration with Phase 1 auth, room, and event store

## Architecture Decisions

- WebSocket server is built with the `ws` library using `http.createServer` upgrade hooks.
- Authentication is handled by verifying a JWT from the URL query string.
- Events are persisted before broadcast to ensure ordering and replay safety.
- Canvas state cache (`canvas_nodes`) is updated from deltas to support snapshots.

## WebSocket Message Flow

1. Client connects to `ws://host/ws?roomId=...&token=...` (upgrade from HTTP).
2. Server verifies JWT and room existence.
3. Server verifies room membership and role from the database.
4. Client sends `RECONNECT` with `lastSequenceNumber`.
5. Server responds:
  - `REPLAY_EVENTS` if `lastSequenceNumber > 0`
  - `FULL_STATE` if `lastSequenceNumber == 0`
6. Client sends `CANVAS_DELTA` or `CURSOR_MOVE` messages.
7. Server validates, appends events, and broadcasts to other clients.

## Room Registry

- `RoomRegistry` maps room IDs to active connections.
- A secondary map tracks connections by WebSocket for quick removal.
- On disconnect, the client is removed and `USER_LEFT` is broadcast.

## Replay Mechanism

- `RECONNECT` payload carries `lastSequenceNumber`.
- Server queries `events` where `sequence_number > lastSequenceNumber`.
- These events are sent in order as `REPLAY_EVENTS`.

## Sequence Number Logic

- Sequence numbers are assigned by SQLite auto-increment on `events` table.
- The assigned sequence is included in broadcast envelopes.
- Clients can rely on ordered replay and apply events sequentially.

## Heartbeat and Reconnect Logic

- Server sends `PING` messages every 5 seconds.
- If no `PONG` within 15 seconds, the socket is terminated.
- Clients are expected to reconnect and send `RECONNECT`.

## RBAC Enforcement

- `RbacService` checks role and node lock state before any mutation.
- Viewers cannot mutate.
- Only Leads can lock/unlock nodes.
- Contributors can delete only their own nodes.
- Unauthorized deltas return `ERROR` with `RBAC_DENIED`.

## File-by-File Explanation

- server/src/ws/WebSocketServer.ts
  - Main WS server, upgrade handling, message routing, and heartbeat loop.
- server/src/ws/RoomRegistry.ts
  - Stores room membership and active WebSocket connections.
- server/src/ws/MessageSchemas.ts
  - Zod schemas for validating envelope and payloads.
- server/src/ws/types.ts
  - `ClientConnection` interface.
- server/src/ws/handlers/canvasDeltaHandler.ts
  - Validates deltas, applies RBAC, appends events, updates cache, broadcasts.
- server/src/ws/handlers/reconnectHandler.ts
  - Sends FULL_STATE or REPLAY_EVENTS depending on last sequence.
- server/src/ws/handlers/cursorMoveHandler.ts
  - Broadcasts cursor moves without persistence.
- server/src/services/RbacService.ts
  - Encapsulates server-side permissions and lock checks.
- server/src/services/CanvasStateService.ts
  - Applies deltas to `canvas_nodes` cache for snapshots.

## Tricky Logic Explained

- In WebSocketServer, `RECONNECT` triggers replay or full snapshot. This ensures clients can recover after disconnect without full reloads.
- Heartbeat logic checks `lastPongAt`. If the client stops responding, the server terminates the socket to free room resources.
- `CanvasStateService.applyDelta` updates the materialized state in SQLite. This enables new users to get full state without replaying all events.

## Developer Notes

- The server expects the client to send `RECONNECT` immediately after connecting.
- Full state snapshots are derived from `canvas_nodes` and are empty until `NODE_CREATED` deltas are processed.
- `CANVAS_DELTA` payloads are stored as-is in the event log for replay safety.
- Event types include `NODE_Z_CHANGED` to support z-index ordering.
- WebSocket upgrades are accepted only on the `/ws` path.

## Assumptions

- Client uses the provided message envelope and sends `RECONNECT` on connect.
- JWT payload contains `roomId` and matches the URL query parameter.
- Node creation payload includes `nodeType`, `x`, and `y`.

## Risks

- If clients never send `RECONNECT`, they will not receive initial state.
- `CanvasStateService` expects standard payload shapes; malformed payloads are rejected but may still exist in logs if validation gaps occur.

## Future Considerations

- Add server-side rate limiting for WebSocket messages.
- Add audit events for role changes.
- Improve schema validation for all delta types.
- Move snapshot delivery to chunked mode for large rooms.
