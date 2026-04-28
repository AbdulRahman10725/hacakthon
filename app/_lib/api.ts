import type { AuthJoinRequest, AuthJoinResponse } from "@/shared/protocol";

export function getApiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_API_BASE;
  if (envBase) return envBase;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4000`;
  }
  return "http://localhost:4000";
}

export async function joinRoom(payload: AuthJoinRequest): Promise<AuthJoinResponse> {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/auth/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let message = "Failed to join room";
      try {
        const body = (await res.json()) as { error?: string };
        message = body.error ?? message;
      } catch {
        const text = await res.text();
        if (text) message = text;
      }
      throw new Error(message);
    }

    return res.json();
  } catch (err) {
    const hint = `Unable to reach server at ${base}. Make sure the backend is running.`;
    if (err instanceof Error && err.message) {
      throw new Error(`${err.message}. ${hint}`);
    }
    throw new Error(hint);
  }
}
