import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

type RouteContext = { params: Promise<{ meetingId: string }> };

async function canAccessMeeting(meetingId: string, userId: string, role: string) {
  const meeting = await prisma.meeting.findFirst({
    where:
      role === "ADMIN"
        ? { id: meetingId }
        : { id: meetingId, OR: [{ hostId: userId }, { participants: { some: { userId } } }] },
    select: { id: true },
  });
  return Boolean(meeting);
}

export async function POST(request: Request, context: RouteContext) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { meetingId } = await context.params;
  if (!(await canAccessMeeting(meetingId, sessionUser.id, sessionUser.role))) {
    return NextResponse.json({ error: "Meeting not found or access denied." }, { status: 404 });
  }
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid message." }, { status: 400 });

  const message = await prisma.meetingMessage.create({
    data: { meetingId, senderId: sessionUser.id, body: parsed.data.body },
    include: { sender: true },
  });

  await prisma.meetingKnowledgeChunk.create({
    data: {
      meetingId,
      sourceType: "CHAT",
      sourceId: message.id,
      content: `${message.sender.name}: ${message.body}`,
      metadata: { senderId: sessionUser.id },
    },
  });

  return NextResponse.json({
    message: {
      id: message.id,
      meetingId: message.meetingId,
      senderId: message.senderId,
      senderName: message.sender.name,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    },
  }, { status: 201 });
}