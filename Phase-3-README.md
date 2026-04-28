# Phase 3 - Canvas Client MVP (Real-Time Collaborative UI)

This document explains the Phase 3 frontend implementation for the LIGMA canvas MVP, built on Phase 1 + Phase 2.

## What Was Implemented

- Full-screen canvas workspace with minimal toolbar
- Infinite canvas pan/zoom (CSS transform on a virtual stage)
- Node system: sticky notes, text nodes, basic shapes (rect, circle)
- Node creation, selection, drag, resize
- Optimistic UI updates for local edits
- WebSocket integration for real-time sync and presence
- Cursor presence with labels/colors
- FULL_STATE sync on join and REPLAY_EVENTS on reconnect
- Basic z-index layering support
- Zustand stores for canvas, presence, and UI interaction state
- Viewer role is read-only in the client (edits disabled)

## Canvas Architecture Overview

The canvas is a single full-viewport stage with a transformed inner layer:

- The `canvas-stage` is the viewport container.
- The `canvas-content` is translated and scaled to simulate infinite space.
- Nodes and cursors are positioned in world coordinates inside `canvas-content`.

This keeps all node rendering simple (absolute positioning) while allowing pan/zoom by adjusting a single transform.

## Rendering System (Step-by-Step)

1. `CanvasStage` renders a full-screen container.
2. `canvas-content` applies `translate(x, y) scale(scale)` from viewport state.
3. `NodeLayer` renders nodes sorted by `zIndex`.
4. `PresenceLayer` renders remote cursors in the same coordinate space.

## Node System Design

Each node is represented by a shared `CanvasNode` shape from `/shared/types` and stored in Zustand:

- `sticky` nodes are styled cards with editable text.
- `text` nodes are lighter text blocks with editable text.
- `rect` and `circle` nodes are basic shape blocks.

Node behavior:

- **Create:** click canvas with tool active.
- **Select:** click node in Select tool.
- **Drag:** pointer drag in Select tool.
- **Resize:** bottom-right handle when selected.
- **Edit text:** double-click on sticky/text nodes.

## Pan & Zoom Implementation

- **Pan:** hold Space or middle mouse button and drag. This updates `viewport.x/y`.
- **Zoom:** `Ctrl + mouse wheel` or `Cmd + mouse wheel`. Zoom is centered on the cursor:
  - Convert cursor to world coordinates before scaling.
  - Recompute translation so the world point stays under the cursor.

This keeps the canvas stable during zoom and feels natural.

## Drag & Resize Logic

Drag and resize are handled with pointer listeners on the window:

- On pointer-down, a ref stores the active node and offsets.
- On move, the world position is recomputed from the cursor and applied to the node.
- Deltas are sent to the server on a short throttle (50–60ms) for smooth collaboration.
- On pointer-up, a final delta is sent to ensure consistency.

## WebSocket Integration

The client uses the Phase 2 protocol and native WebSocket API:

- `RECONNECT` is sent on connect with `lastSequenceNumber`.
- `FULL_STATE` replaces local nodes/members when the client is new.
- `REPLAY_EVENTS` applies missed events sequentially.
- `CANVAS_DELTA` messages are applied to the local store.
- `CURSOR_MOVE` messages update presence.

## Optimistic Updates

All local edits update Zustand immediately, then send a delta to the server. Because the server does not echo events back to the origin client, the UI remains responsive without waiting for a server confirmation.

## Presence (Remote Cursors)

- Cursor positions are sent via `CURSOR_MOVE` at 50ms intervals.
- Each cursor includes `displayName` and `color`.
- Remote cursors are rendered as a dot + label in world space.

## FULL_STATE Sync on Join

After connecting, the client sends `RECONNECT` with the last sequence number:

- If `0`, the server responds with `FULL_STATE` (snapshot).
- Otherwise, the server sends `REPLAY_EVENTS` since that sequence.

## State Management (Zustand)

Stores are split by concern:

- `canvasStore`: nodes + viewport (pan/zoom)
- `presenceStore`: cursor positions and member info
- `uiStore`: tool selection, selection, edit state
- `sessionStore`: auth session + connection status

This avoids unnecessary re-renders and keeps UI interactions independent from server state.

## File-by-File Explanation

- app/page.tsx
  - Join/create room UI and session persistence.
- app/room/[roomId]/page.tsx
  - Loads the room client for a specific room.
- app/_components/room/RoomClient.tsx
  - Bootstraps WebSocket connection and session loading.
- app/_components/canvas/CanvasWorkspace.tsx
  - High-level layout (toolbar + stage + status).
- app/_components/canvas/CanvasStage.tsx
  - Pan/zoom, pointer handling, node creation, drag/resize.
- app/_components/canvas/NodeLayer.tsx
  - Renders nodes ordered by z-index.
- app/_components/canvas/PresenceLayer.tsx
  - Displays remote cursor positions and labels.
- app/_components/canvas/nodes/StickyNote.tsx
  - Sticky note rendering + text editing.
- app/_components/canvas/nodes/TextNode.tsx
  - Text block rendering + editing.
- app/_components/canvas/nodes/ShapeNode.tsx
  - Basic rect/circle rendering + resize handle.
- app/_components/toolbar/Toolbar.tsx
  - Minimal tool selection UI.
- app/_lib/wsClient.ts
  - WebSocket connection, reconnect, and message sending.
- app/_lib/canvasEvents.ts
  - Applies FULL_STATE, REPLAY_EVENTS, and deltas to stores.
- app/_lib/geometry.ts
  - Screen/world coordinate transforms used in pan/zoom and drag.
- app/_stores/*.ts
  - Zustand stores for canvas, presence, UI, and session.

## Complex Logic Explained

- **Zoom math:** `screenToWorld` converts cursor coordinates into world space before applying scale. This keeps the zoom focused under the cursor.
- **Drag offsets:** offsets are stored in world coordinates to prevent jumps when zoomed.
- **Throttle for deltas:** small delay prevents flooding the server while dragging.

## Performance Considerations

- Node render ordering is memoized and sorted only when nodes change.
- Stores are split to reduce global re-renders.
- Drag/resize writes are throttled to keep UI smooth.

## Known Limitations

- No CRDT text updates yet (plain text updates only).
- No conflict resolution UI in the client.
- No advanced selection box or multi-select.
- No persistence of viewport per user.

## Future Improvements

- CRDT text editing integration.
- Multi-select and group transforms.
- Virtualized rendering for large rooms.
- Better pan gestures (trackpad support).
- Richer toolbar and keyboard shortcuts.
