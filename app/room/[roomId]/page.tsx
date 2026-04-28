import RoomClient from "@/app/_components/room/RoomClient";

export default function RoomPage({ params }: { params: { roomId: string } }) {
  return <RoomClient roomId={params.roomId} />;
}
