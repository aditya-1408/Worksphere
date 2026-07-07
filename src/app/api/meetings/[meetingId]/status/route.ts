import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const statusSchema = z.object({ action: z.enum(["start", "join", "leave", "end", "cancel"]) });
type RouteContext = { params: Promise<{ meetingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { meetingId } = await context.params;
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid meeting action." }, { status: 400 });

  const meeting = await prisma.meeting.findFirst({
    where:
      sessionUser.role === "ADMIN"
        ? { id: meetingId }
        : { id: meetingId, OR: [{ hostId: sessionUser.id }, { participants: { some: { userId: sessionUser.id } } }] },
    select: { id: true, hostId: true, title: true },
  });
  if (!meeting) return NextResponse.json({ error: "Meeting not found or access denied." }, { status: 404 });

  const now = new Date();
  const isHostOrAdmin = sessionUser.role === "ADMIN" || meeting.hostId === sessionUser.id;

  if ((parsed.data.action === "start" || parsed.data.action === "end" || parsed.data.action === "cancel") && !isHostOrAdmin) {
    return NextResponse.json({ error: "Only the host or admin can control meeting status." }, { status: 403 });
  }

  if (parsed.data.action === "start") {
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "LIVE", startedAt: now } });
  }
  if (parsed.data.action === "end") {
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "ENDED", endedAt: now } });
    // Auto-disconnect all participants when meeting ends
    await prisma.meetingParticipant.updateMany({
      where: { meetingId, status: "JOINED" },
      data: { status: "LEFT", leftAt: now },
    });
  }
  if (parsed.data.action === "cancel") {
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "CANCELLED", endedAt: now } });
  }
  if (parsed.data.action === "leave") {
    // Mark as LEFT but with a grace period for reconnection
    await prisma.meetingParticipant.updateMany({
      where: { meetingId, userId: sessionUser.id },
      data: { status: "LEFT", leftAt: now },
    });
  }
  if (parsed.data.action === "join") {
    // Check if rejoining within 30 seconds (reconnect buffer)
    const existing = await prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId: sessionUser.id } },
    });
    
    const isReconnecting = existing?.leftAt && 
      (now.getTime() - existing.leftAt.getTime()) < 30000; // 30 second buffer
    
    await prisma.meetingParticipant.upsert({
      where: { meetingId_userId: { meetingId, userId: sessionUser.id } },
      update: { 
        status: "JOINED", 
        joinedAt: isReconnecting ? existing.joinedAt : now, // Preserve original join time if reconnecting
        leftAt: null 
      },
      create: { meetingId, userId: sessionUser.id, status: "JOINED", joinedAt: now },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: sessionUser.id,
      entityType: "Meeting",
      entityId: meetingId,
      action: `Meeting ${parsed.data.action}`,
      afterJson: { title: meeting.title, at: now.toISOString() },
    },
  });

  return NextResponse.json({ ok: true });
}