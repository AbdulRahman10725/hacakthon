import express from "express";
import cors from "cors";
import http from "http";
import { loadEnv } from "./config/env";
import { createDb, migrateDb } from "./db";
import { AuthService } from "./services/AuthService";
import { CanvasStateService } from "./services/CanvasStateService";
import { EventStore } from "./services/EventStore";
import { RbacService } from "./services/RbacService";
import { RoomService } from "./services/RoomService";
import { RoomStateService } from "./services/RoomStateService";
import { WebSocketServer } from "./ws/WebSocketServer";
import { authMiddleware } from "./rest/middleware/auth";
import { createAuthRouter } from "./rest/routes/auth";
import { createRoomsRouter } from "./rest/routes/rooms";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
migrateDb(db);

const app = express();
const server = http.createServer(app);

app.use(express.json());

const isDev = env.NODE_ENV !== "production";
const corsOrigin = env.CLIENT_ORIGIN ?? (isDev ? true : false);

if (corsOrigin) {
  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "PATCH"],
    })
  );
}

const roomService = new RoomService(db);
const authService = new AuthService(db, env.JWT_SECRET);
const eventStore = new EventStore(db);
const roomStateService = new RoomStateService(db);
const rbacService = new RbacService(db);
const canvasStateService = new CanvasStateService(db);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", createAuthRouter({ authService, roomService }));
app.use(
  "/api/rooms",
  authMiddleware(env.JWT_SECRET),
  createRoomsRouter({ roomService, eventStore, roomStateService })
);

new WebSocketServer({
  server,
  jwtSecret: env.JWT_SECRET,
  eventStore,
  roomService,
  roomState: roomStateService,
  rbac: rbacService,
  canvasState: canvasStateService,
});

server.listen(Number(env.PORT), () => {
  console.log(`Server listening on :${env.PORT}`);
});
