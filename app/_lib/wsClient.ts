import type { WsEnvelope } from "@/shared/protocol";

export type WsStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface WsClientOptions {
  roomId: string;
  token: string;
  onMessage: (message: WsEnvelope) => void;
  onStatus: (status: WsStatus) => void;
  getLastSequence: () => number;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = true;
  private options: WsClientOptions;

  constructor(options: WsClientOptions) {
    this.options = options;
  }

  connect(): void {
    this.options.onStatus(
      this.reconnectAttempt > 0 ? "reconnecting" : "connecting"
    );

    const wsBase = getWsBase();
    const url = `${wsBase}/ws?roomId=${this.options.roomId}&token=${this.options.token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.options.onStatus("connected");
      this.send("RECONNECT", {
        lastSequenceNumber: this.options.getLastSequence(),
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WsEnvelope;
        if (message.type === "PING") {
          this.send("PONG", {});
          return;
        }
        this.options.onMessage(message);
      } catch {
        // Ignore malformed messages.
      }
    };

    this.ws.onclose = () => {
      this.options.onStatus("disconnected");
      if (this.shouldReconnect) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.ws?.close();
  }

  send(type: WsEnvelope["type"], payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message: WsEnvelope = {
      type,
      roomId: this.options.roomId,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.ws.send(JSON.stringify(message));
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt += 1;
    const baseDelay = Math.min(500 * 2 ** (this.reconnectAttempt - 1), 30000);
    const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
    const delay = baseDelay + jitter;
    setTimeout(() => this.connect(), delay);
  }
}

function getWsBase(): string {
  const envBase = process.env.NEXT_PUBLIC_WS_BASE;
  if (envBase) return envBase;

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.hostname}:4000`;
  }

  return "ws://localhost:4000";
}

let activeClient: WsClient | null = null;

export function setActiveClient(client: WsClient | null): void {
  activeClient = client;
}

export function sendCanvasDelta(payload: Record<string, unknown>): void {
  if (!activeClient) return;
  activeClient.send("CANVAS_DELTA", payload);
}

export function sendCursorMove(payload: Record<string, unknown>): void {
  if (!activeClient) return;
  activeClient.send("CURSOR_MOVE", payload);
}
