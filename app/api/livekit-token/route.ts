import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { sessionId, uploadedFiles = [] } = await req.json();

  const roomName = `voice-${sessionId}` + Date.now();
  const httpUrl = process.env.LIVEKIT_URL!.replace("wss://", "https://");
  const metadata = JSON.stringify({ sessionId, uploadedFiles });

  const roomService = new RoomServiceClient(
    httpUrl,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  );

  try {
    await roomService.createRoom({
      name: roomName,
      metadata,
      emptyTimeout: 300,
    });
    console.log("✅ Room created:", roomName);
  } catch (e: any) {
    try {
      await roomService.updateRoomMetadata(roomName, metadata);
      console.log("✅ Metadata updated");
    } catch {}
  }

  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity: `user-${sessionId}` },
  );

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return NextResponse.json({ token: await token.toJwt() });
}
