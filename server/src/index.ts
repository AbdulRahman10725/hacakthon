import express from "express";
import cors from "cors";
import http from "http";
import { loadEnv } from "./config/env";
import { createDb, migrateDb } from "./db";
import { authMiddleware } from "./rest/middleware/auth";
import { createAuthRouter } from "./rest/routes/auth";
import { createClassifyRouter } from "./rest/routes/classify";
import { createRoomsRouter } from "./rest/routes/rooms";
import { AIClassifierService } from "./services/AIClassifierService";
import { AuthService } from "./services/AuthService";
import { CanvasStateService } from "./services/CanvasStateService";
import { EventStore } from "./services/EventStore";
import { RbacService } from "./services/RbacService";
import { RoomService } from "./services/RoomService";
import { RoomStateService } from "./services/RoomStateService";
import { TaskService } from "./services/TaskService";
import { WebSocketServer } from "./ws/WebSocketServer";

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
const aiClassifier = new AIClassifierService();
const taskService = new TaskService(db);

const wsServer = new WebSocketServer({
  server,
  jwtSecret: env.JWT_SECRET,
  eventStore,
  roomService,
  roomState: roomStateService,
  rbac: rbacService,
  canvasState: canvasStateService,
  aiClassifier,
  taskService,
});

app.get("/health", (_req, res) => {
  const wsMetrics = wsServer.getMetrics();
  let dbConnectionOk = false;

  try {
    db.prepare("SELECT 1 as ok").get();
    dbConnectionOk = true;
  } catch {
    dbConnectionOk = false;
  }

  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    activeRooms: wsMetrics.activeRooms,
    activeConnections: wsMetrics.activeConnections,
    eventsProcessed: wsMetrics.eventsProcessed,
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    dbConnectionOk,
  });
});

app.use("/api/auth", createAuthRouter({ authService, roomService }));
app.use(
  "/api/classify",
  authMiddleware(env.JWT_SECRET),
  createClassifyRouter({ aiClassifier })
);
app.use(
  "/api/rooms",
  authMiddleware(env.JWT_SECRET),
  createRoomsRouter({
    roomService,
    eventStore,
    roomStateService,
    rbacService,
    taskService,
    broadcastToRoom: wsServer.broadcastToRoom.bind(wsServer),
  })
);

server.listen(Number(env.PORT), () => {
  console.log(`Server listening on :${env.PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`[${signal}] Shutting down…`);
  wsServer.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
