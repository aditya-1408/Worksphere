import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ meetingId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { meetingId } = await context.params;

  // Verify user has access to this meeting
  const meeting = await prisma.meeting.findFirst({
    where:
      sessionUser.role === "ADMIN"
        ? { id: meetingId }
        : {
            id: meetingId,
            OR: [
              { hostId: sessionUser.id },
              { participants: { some: { userId: sessionUser.id } } },
            ],
          },
    select: {
      id: true,
      livekitRoomName: true,
      status: true,
      hostId: true,
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found or access denied." }, { status: 404 });
  }

  if (!meeting.livekitRoomName) {
    return NextResponse.json({ error: "Meeting room not configured." }, { status: 400 });
  }

  // Check if LiveKit is configured
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "LiveKit is not configured. Please add LIVEKIT credentials to environment variables." },
      { status: 503 }
    );
  }

  // Create access token
  const token = new AccessToken(apiKey, apiSecret, {
    identity: sessionUser.id,
    name: sessionUser.name,
    metadata: JSON.stringify({
      userId: sessionUser.id,
      role: sessionUser.role,
      email: sessionUser.email,
    }),
  });

  // Grant permissions
  token.addGrant({
    room: meeting.livekitRoomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  // Admin and host get additional permissions
  if (sessionUser.role === "ADMIN" || meeting.hostId === sessionUser.id) {
    token.addGrant({
      roomAdmin: true,
    });
  }

  const jwt = await token.toJwt();

  return NextResponse.json({
    token: jwt,
    wsUrl,
    roomName: meeting.livekitRoomName,
    identity: sessionUser.id,
    name: sessionUser.name,
  });
}
