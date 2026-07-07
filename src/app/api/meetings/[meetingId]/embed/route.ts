import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateEmbedding } from "@/lib/gemini";
import { chunkText } from "@/lib/rag";

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
      summaries: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found or access denied." }, { status: 404 });
  }

  try {
    const chunksCreated: string[] = [];

    // 1. Chunk and embed chat messages (group every 5 messages)
    const messageGroups: typeof meeting.messages[] = [];
    for (let i = 0; i < meeting.messages.length; i += 5) {
      messageGroups.push(meeting.messages.slice(i, i + 5));
    }

    for (const group of messageGroups) {
      const content = group.map((msg) => `${msg.sender.name}: ${msg.body}`).join("\n");
      if (!content.trim()) continue;

      const embedding = await generateEmbedding(content);
      if (!embedding) continue;

      await prisma.meetingKnowledgeChunk.create({
        data: {
          meetingId,
          sourceType: "CHAT",
          sourceId: group[0].id,
          content,
          embedding,
          embeddingModel: process.env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004",
          metadata: {
            messageCount: group.length,
            startTime: group[0].createdAt,
            endTime: group[group.length - 1].createdAt,
          },
        },
      });
      chunksCreated.push("CHAT");
    }

    // 2. Embed each document
    for (const doc of meeting.documents) {
      const content = doc.textContent || doc.title;
      if (!content.trim()) continue;

      // Chunk large documents
      const chunks = chunkText(content, 1000);
      
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(chunks[i]);
        if (!embedding) continue;

        await prisma.meetingKnowledgeChunk.create({
          data: {
            meetingId,
            sourceType: "DOCUMENT",
            sourceId: doc.id,
            content: chunks[i],
            embedding,
            embeddingModel: process.env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004",
            metadata: {
              title: doc.title,
              fileUrl: doc.fileUrl,
              chunkIndex: i,
              totalChunks: chunks.length,
            },
          },
        });
        chunksCreated.push("DOCUMENT");
      }
    }

    // 3. Embed summary if exists
    if (meeting.summaries.length > 0) {
      const summary = meeting.summaries[0];
      
      // Main summary
      const summaryContent = `Meeting Summary: ${summary.summary}`;
      const summaryEmbedding = await generateEmbedding(summaryContent);
      if (summaryEmbedding) {
        await prisma.meetingKnowledgeChunk.create({
          data: {
            meetingId,
            sourceType: "SUMMARY",
            sourceId: summary.id,
            content: summaryContent,
            embedding: summaryEmbedding,
            embeddingModel: process.env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004",
            metadata: {
              type: "main_summary",
              sentiment: summary.sentiment,
            },
          },
        });
        chunksCreated.push("SUMMARY");
      }

      // Discussion points
      const discussionPoints = Array.isArray(summary.discussionPoints) 
        ? summary.discussionPoints 
        : [];
      if (discussionPoints.length > 0) {
        const discussionContent = `Discussion Points:\n${discussionPoints.join("\n")}`;
        const discussionEmbedding = await generateEmbedding(discussionContent);
        if (discussionEmbedding) {
          await prisma.meetingKnowledgeChunk.create({
            data: {
              meetingId,
              sourceType: "SUMMARY",
              sourceId: summary.id,
              content: discussionContent,
              embedding: discussionEmbedding,
              embeddingModel: process.env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004",
              metadata: {
                type: "discussion_points",
              },
            },
          });
          chunksCreated.push("SUMMARY");
        }
      }

      // Decisions
      const decisions = Array.isArray(summary.decisions) ? summary.decisions : [];
      if (decisions.length > 0) {
        const decisionsContent = `Decisions Made:\n${decisions.join("\n")}`;
        const decisionsEmbedding = await generateEmbedding(decisionsContent);
        if (decisionsEmbedding) {
          await prisma.meetingKnowledgeChunk.create({
            data: {
              meetingId,
              sourceType: "SUMMARY",
              sourceId: summary.id,
              content: decisionsContent,
              embedding: decisionsEmbedding,
              embeddingModel: process.env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004",
              metadata: {
                type: "decisions",
              },
            },
          });
          chunksCreated.push("SUMMARY");
        }
      }
    }

    return NextResponse.json({
      success: true,
      chunksCreated: chunksCreated.length,
      breakdown: {
        chat: chunksCreated.filter((t) => t === "CHAT").length,
        documents: chunksCreated.filter((t) => t === "DOCUMENT").length,
        summary: chunksCreated.filter((t) => t === "SUMMARY").length,
      },
      message: `Generated ${chunksCreated.length} knowledge chunks for semantic search.`,
    });
  } catch (error) {
    console.error("Embedding generation error:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to generate embeddings.",
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
