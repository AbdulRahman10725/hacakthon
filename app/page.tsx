"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { joinRoom } from "@/app/_lib/api";
import { saveSession } from "@/app/_lib/storage";
import { useSessionStore } from "@/app/_stores/sessionStore";
import type { Role } from "@/shared/types";

export default function HomePage() {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const [displayName, setDisplayName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [role, setRole] = useState<Role>("CONTRIBUTOR");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await joinRoom({
        displayName: displayName.trim(),
        roomId: roomId.trim() || undefined,
        role,
      });

      const session = {
        token: response.token,
        roomId: response.roomId,
        userId: response.userId,
        role: response.role,
        displayName: response.displayName,
        color: response.color,
      };

      saveSession(session);
      setSession(session);
      router.push(`/room/${response.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="join-page">
      <form className="join-card" onSubmit={handleSubmit}>
        <h1>LIGMA</h1>
        <p>Join or create a room to start collaborating.</p>
        <label>
          Display Name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
            required
          />
        </label>
        <label>
          Room ID (optional)
          <input
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            placeholder="Leave empty to create a room"
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="LEAD">Lead</option>
            <option value="CONTRIBUTOR">Contributor</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </label>
        {error && <div className="error-text">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? "Joining..." : "Enter Workspace"}
        </button>
      </form>
    </main>
  );
}
