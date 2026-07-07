import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/gemini";

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 and 1, where 1 means identical
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

/**
 * Search meeting knowledge using semantic similarity
 * @param query - User's search query
 * @param meetingId - Optional: limit search to specific meeting
 * @param limit - Maximum number of results to return
 * @returns Array of relevant chunks with similarity scores
 */
export async function searchMeetingKnowledge(
  query: string,
  meetingId?: string,
  limit: number = 5
): Promise<Array<{
  chunk: {
    id: string;
    meetingId: string;
    sourceType: string;
    content: string;
    metadata: any;
    meeting: {
      id: string;
      title: string;
      scheduledAt: string;
      hostName: string;
    };
  };
  similarity: number;
}>> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    throw new Error("Failed to generate embedding for query");
  }

  // Load all knowledge chunks with meeting info
  const chunks = await prisma.meetingKnowledgeChunk.findMany({
    where: meetingId ? { meetingId } : {},
    include: {
      meeting: {
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          host: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Calculate similarity scores
  const results = chunks
    .map((chunk) => {
      if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
        return null;
      }
      
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding as number[]);
      return {
        chunk: {
          id: chunk.id,
          meetingId: chunk.meetingId,
          sourceType: chunk.sourceType,
          content: chunk.content,
          metadata: chunk.metadata,
          meeting: {
            id: chunk.meeting.id,
            title: chunk.meeting.title,
            scheduledAt: chunk.meeting.scheduledAt.toISOString(),
            hostName: chunk.meeting.host.name,
          },
        },
        similarity,
      };
    })
    .filter((result): result is NonNullable<typeof result> => result !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Chunk text into smaller pieces for embedding
 * @param text - Text to chunk
 * @param maxLength - Maximum characters per chunk
 * @returns Array of text chunks
 */
export function chunkText(text: string, maxLength: number = 1000): string[] {
  if (text.length <= maxLength) return [text];
  
  const chunks: string[] = [];
  let currentChunk = "";
  
  // Split by sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim());
  
  return chunks;
}
