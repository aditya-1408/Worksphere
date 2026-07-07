import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const documentSchema = z.object({
  title: z.string().trim().min(2).max(160),
  fileUrl: z.string().trim().url().max(1000),
  fileName: z.string().trim().max(240).optional().nullable(),
  mimeType: z.string().trim().max(120).optional().nullable(),
  textContent: z.string().trim().max(20000).optional().nullable(),
});

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

async function canManageMeeting(meetingId: string, userId: string, role: string) {
  const meeting = await prisma.meeting.findFirst({
    where:
      role === "ADMIN"
        ? { id: meetingId }
        : { 
            id: meetingId, 
            OR: [
              { hostId: userId }, 
              { participants: { some: { userId, status: "JOINED" } } }
            ]
          },
    select: { id: true },
  });
  return Boolean(meeting);
}

export async function GET(request: Request, context: RouteContext) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  
  const { meetingId } = await context.params;
  if (!(await canAccessMeeting(meetingId, sessionUser.id, sessionUser.role))) {
    return NextResponse.json({ error: "Meeting not found or access denied." }, { status: 404 });
  }

  const documents = await prisma.meetingDocument.findMany({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    documents: documents.map((doc) => ({
      id: doc.id,
      meetingId: doc.meetingId,
      title: doc.title,
      fileUrl: doc.fileUrl,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { meetingId } = await context.params;
  if (!(await canManageMeeting(meetingId, sessionUser.id, sessionUser.role))) {
    return NextResponse.json({ error: "Only joined participants can attach documents." }, { status: 403 });
  }
  const parsed = documentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid document." }, { status: 400 });

  const document = await prisma.meetingDocument.create({
    data: {
      meetingId,
      title: parsed.data.title,
      fileUrl: parsed.data.fileUrl,
      fileName: parsed.data.fileName || null,
      mimeType: parsed.data.mimeType || null,
      textContent: parsed.data.textContent || null,
    },
  });

  await prisma.meetingKnowledgeChunk.create({
    data: {
      meetingId,
      sourceType: "DOCUMENT",
      sourceId: document.id,
      content: parsed.data.textContent || `${parsed.data.title}: ${parsed.data.fileUrl}`,
      metadata: { title: parsed.data.title, fileUrl: parsed.data.fileUrl },
    },
  });

  return NextResponse.json({
    document: {
      id: document.id,
      title: document.title,
      fileUrl: document.fileUrl,
      status: document.status,
      createdAt: document.createdAt.toISOString(),
    },
  }, { status: 201 });
}