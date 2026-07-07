import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { searchMeetingKnowledge } from "@/lib/rag";
import { generateEmbedding } from "@/lib/gemini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { question, meetingId, limit = 5 } = body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    // Search for relevant chunks
    const relevantChunks = await searchMeetingKnowledge(
      question.trim(),
      meetingId,
      Math.min(limit, 10) // Cap at 10 chunks
    );

    if (relevantChunks.length === 0) {
      return NextResponse.json({
        answer: "No relevant information found in meeting records.",
        sources: [],
        question: question.trim(),
      });
    }

    // Build context from chunks
    const context = relevantChunks
      .map((result, idx) => {
        const meeting = result.chunk.meeting;
        const date = new Date(meeting.scheduledAt).toLocaleDateString();
        return `[Source ${idx + 1} - ${meeting.title} (${date})]:\n${result.chunk.content}`;
      })
      .join("\n\n");

    // Generate answer using Gemini with RAG context
    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        answer: "AI answering is not available (Gemini API not configured).",
        sources: relevantChunks.map((r) => ({
          meetingId: r.chunk.meetingId,
          meetingTitle: r.chunk.meeting.title,
          meetingDate: r.chunk.meeting.scheduledAt,
          content: r.chunk.content.substring(0, 200) + "...",
          sourceType: r.chunk.sourceType,
          similarity: r.similarity,
        })),
        question: question.trim(),
      });
    }

    const prompt = `You are a meeting intelligence assistant for WorkSphere. Answer the user's question based ONLY on the provided meeting context.

## Meeting Context:
${context}

## User Question:
${question.trim()}

## Instructions:
- Answer based ONLY on the provided context
- If the context doesn't contain relevant information, say "I don't have information about that in the available meeting records"
- Cite which meeting(s) your answer comes from
- Be specific and concise
- Use professional business language

Provide your answer:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API failed with ${response.status}`);
    }

    const data = await response.json();
    const answer =
      data.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join("") ||
      "Unable to generate answer.";

    return NextResponse.json({
      answer,
      sources: relevantChunks.map((r) => ({
        meetingId: r.chunk.meetingId,
        meetingTitle: r.chunk.meeting.title,
        meetingDate: r.chunk.meeting.scheduledAt,
        meetingHost: r.chunk.meeting.hostName,
        content: r.chunk.content.substring(0, 300) + (r.chunk.content.length > 300 ? "..." : ""),
        sourceType: r.chunk.sourceType,
        similarity: Math.round(r.similarity * 100),
      })),
      question: question.trim(),
    });
  } catch (error) {
    console.error("Query API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process query.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
