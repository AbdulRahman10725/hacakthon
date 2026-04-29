import { use } from "react";
import RoomClient from "@/app/_components/room/RoomClient";

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  return <RoomClient roomId={roomId} />;
}