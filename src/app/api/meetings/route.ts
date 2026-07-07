import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type MeetingWithRelations = Prisma.MeetingGetPayload<{
  include: {
    host: true;
    participants: { include: { user: true } };
    documents: true;
  };
}>;

const createMeetingSchema = z.object({
  title: z.string().trim().min(3).max(140),
  agenda: z.string().trim().max(3000).optional().nullable(),
  scheduledAt: z.string().datetime().or(z.string().date()),
  participantIds: z.array(z.string().min(1)).min(1).max(20),
});

function serializeMeeting(meeting: MeetingWithRelations) {
  return {
    id: meeting.id,
    title: meeting.title,
    agenda: meeting.agenda,
    department: meeting.department,
    hostId: meeting.hostId,
    hostName: meeting.host.name,
    status: meeting.status,
    scheduledAt: meeting.scheduledAt.toISOString(),
    startedAt: meeting.startedAt?.toISOString() ?? null,
    endedAt: meeting.endedAt?.toISOString() ?? null,
    livekitRoomName: meeting.livekitRoomName,
    participantCount: meeting.participants.length,
    participants: meeting.participants.map((participant) => ({
      userId: participant.userId,
      name: participant.user.name,
      email: participant.user.email,
      role: participant.user.role,
      status: participant.status,
      joinedAt: participant.joinedAt?.toISOString() ?? null,
      leftAt: participant.leftAt?.toISOString() ?? null,
    })),
    documents: meeting.documents.map((document) => ({
      id: document.id,
      title: document.title,
      fileUrl: document.fileUrl,
      status: document.status,
      createdAt: document.createdAt.toISOString(),
    })),
    summaryStatus: meeting.summaryStatus,
    transcriptStatus: meeting.transcriptStatus,
  };
}

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const where: Prisma.MeetingWhereInput =
    sessionUser.role === "ADMIN"
      ? {}
      : sessionUser.role === "MANAGER"
        ? { OR: [{ hostId: sessionUser.id }, { participants: { some: { userId: sessionUser.id } } }] }
        : { participants: { some: { userId: sessionUser.id } } };

  const meetings = await prisma.meeting.findMany({
    where,
    include: {
      host: true,
      participants: { include: { user: true }, orderBy: { user: { name: "asc" } } },
      documents: { orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
  });

  return NextResponse.json({ meetings: meetings.map(serializeMeeting) });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (sessionUser.role !== "MANAGER" && sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Only managers and admins can schedule meetings." }, { status: 403 });
  }

  const parsed = createMeetingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid meeting payload." }, { status: 400 });
  }

  const uniqueParticipantIds = [...new Set(parsed.data.participantIds.filter((id) => id !== sessionUser.id))];
  const allowedParticipants = await prisma.user.findMany({
    where:
      sessionUser.role === "ADMIN"
        ? { id: { in: uniqueParticipantIds } }
        : { id: { in: uniqueParticipantIds }, managerId: sessionUser.id },
    select: { id: true, department: true },
  });

  if (allowedParticipants.length !== uniqueParticipantIds.length) {
    return NextResponse.json({ error: "One or more participants are outside your permitted team." }, { status: 403 });
  }

  const cycle = await prisma.cycle.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const department = allowedParticipants[0]?.department ?? sessionUser.department;
  const meeting = await prisma.meeting.create({
    data: {
      title: parsed.data.title,
      agenda: parsed.data.agenda || null,
      department,
      hostId: sessionUser.id,
      cycleId: cycle?.id,
      scheduledAt: new Date(parsed.data.scheduledAt),
      livekitRoomName: `worksphere-${crypto.randomUUID()}`,
      participants: {
        create: uniqueParticipantIds.map((userId) => ({ userId })),
      },
      messages: {
        create: {
          senderId: sessionUser.id,
          body: `Meeting scheduled: ${parsed.data.title}`,
        },
      },
      knowledgeChunks: {
        create: parsed.data.agenda
          ? [{ sourceType: "AGENDA", content: parsed.data.agenda, metadata: { title: parsed.data.title } }]
          : [],
      },
    },
    include: {
      host: true,
      participants: { include: { user: true }, orderBy: { user: { name: "asc" } } },
      documents: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: sessionUser.id,
      entityType: "Meeting",
      entityId: meeting.id,
      action: "Scheduled meeting",
      afterJson: { title: meeting.title, participantIds: uniqueParticipantIds },
    },
  });

  return NextResponse.json({ meeting: serializeMeeting(meeting) }, { status: 201 });
}