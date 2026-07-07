import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateMeetingSummary } from "@/lib/gemini";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { meetingId } = await params;

  // Check meeting exists and user has access
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: meetingId,
      OR: [
        { hostId: sessionUser.id },
        { participants: { some: { userId: sessionUser.id, status: { not: "DECLINED" } } } },
        ...(sessionUser.role === "ADMIN" ? [{}] : []),
      ],
    },
    include: {
      messages: {
        include: { sender: true },
        orderBy: { createdAt: "asc" },
      },
      documents: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found or access denied." }, { status: 404 });
  }

  if (meeting.status !== "ENDED" && meeting.status !== "CANCELLED") {
    return NextResponse.json({ error: "Can only generate summary for ended meetings." }, { status: 400 });
  }

  // Check if summary already exists
  const existingSummary = await prisma.meetingSummary.findFirst({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
  });

  if (existingSummary) {
    return NextResponse.json({ 
      summary: existingSummary,
      message: "Summary already exists. Returning existing summary." 
    });
  }

  try {
    // Collect all meeting content
    const chatText = meeting.messages
      .map((msg) => `${msg.sender.name}: ${msg.body}`)
      .join("\n");

    const documentsText = meeting.documents
      .map((doc) => `${doc.title}: ${doc.textContent || doc.fileUrl}`)
      .join("\n");

    // Generate AI summary
    const aiSummary = await generateMeetingSummary({
      title: meeting.title,
      agenda: meeting.agenda,
      transcript: "", // Transcript feature coming later
      chat: chatText,
      documents: documentsText,
    });

    // Store summary in database
    const summary = await prisma.meetingSummary.create({
      data: {
        meetingId,
        summary: aiSummary.summary,
        discussionPoints: aiSummary.discussionPoints,
        decisions: aiSummary.decisions,
        blockers: aiSummary.blockers,
        sentiment: aiSummary.sentiment,
        followUps: aiSummary.followUps,
        model: process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash",
      },
    });

    // Create action items
    const actionItems = await Promise.all(
      aiSummary.actionItems.map((item) =>
        prisma.meetingActionItem.create({
          data: {
            meetingId,
            title: item.title,
            description: item.description
              ? `${item.description}${item.assigneeHint ? ` (Suggested assignee: ${item.assigneeHint})` : ""}`
              : item.assigneeHint
              ? `Suggested assignee: ${item.assigneeHint}`
              : null,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            status: "PENDING",
          },
        })
      )
    );

    // Update meeting summary status
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { summaryStatus: "GENERATED" },
    });

    return NextResponse.json({
      summary,
      actionItems,
      message: "Summary generated successfully.",
    });
  } catch (error) {
    console.error("Summary generation error:", error);
    
    // Update meeting to show error (just use a string status)
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { summaryStatus: "ERROR" as any }, // Meeting.summaryStatus is a string
    });

    return NextResponse.json(
      { 
        error: "Failed to generate summary.",
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { meetingId } = await params;

  // Check meeting access
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: meetingId,
      OR: [
        { hostId: sessionUser.id },
        { participants: { some: { userId: sessionUser.id, status: { not: "DECLINED" } } } },
        ...(sessionUser.role === "ADMIN" ? [{}] : []),
      ],
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found or access denied." }, { status: 404 });
  }

  // Get summary and action items
  const summary = await prisma.meetingSummary.findFirst({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
  });

  const actionItems = await prisma.meetingActionItem.findMany({
    where: { meetingId },
    orderBy: { createdAt: "asc" },
  });

  if (!summary) {
    return NextResponse.json({ 
      summary: null,
      actionItems: [],
      summaryStatus: meeting.summaryStatus 
    });
  }

  return NextResponse.json({
    summary,
    actionItems,
    summaryStatus: meeting.summaryStatus,
  });
}
