type GeminiSummaryInput = {
  title: string;
  agenda?: string | null;
  transcript: string;
  chat: string;
  documents: string;
};

export type GeminiMeetingSummary = {
  summary: string;
  discussionPoints: string[];
  decisions: string[];
  blockers: string[];
  sentiment: string;
  followUps: string[];
  actionItems: Array<{ title: string; description?: string; assigneeHint?: string; dueDate?: string }>;
};

const defaultSummary: GeminiMeetingSummary = {
  summary: "AI summary is unavailable because Gemini is not configured.",
  discussionPoints: [],
  decisions: [],
  blockers: [],
  sentiment: "Not analyzed",
  followUps: [],
  actionItems: [],
};

function geminiKey() {
  return process.env.GEMINI_API_KEY?.trim();
}

function geminiModel() {
  // Try different model options for better compatibility
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  if (configuredModel) return configuredModel;
  
  // Fallback models in order of preference (Gemini 2.5 is newer and better)
  return "gemini-2.5-flash";
}

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i)?.[1];
  const raw = fenced ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

export async function generateMeetingSummary(input: GeminiSummaryInput): Promise<GeminiMeetingSummary> {
  const key = geminiKey();
  if (!key) return defaultSummary;

  const prompt = `You are a professional Meeting Intelligence Assistant for WorkSphere, an enterprise goal management platform. Your task is to analyze meeting content and generate a comprehensive, actionable summary in a structured format.

## Meeting Details
**Title:** ${input.title}
**Agenda:** ${input.agenda || "No formal agenda provided"}

## Meeting Content

### Transcript/Discussion
${input.transcript || "No transcript available"}

### Chat Messages
${input.chat || "No chat messages recorded"}

### Shared Documents
${input.documents || "No documents attached"}

## Your Task
Analyze the above meeting content and generate a professional executive summary following these guidelines:

### 1. Summary (2-4 sentences)
Provide a concise executive summary that captures the meeting's purpose, key outcomes, and overall effectiveness. Write in professional business language suitable for C-level executives.

### 2. Discussion Points (3-7 bullet points)
Extract the main topics discussed during the meeting. Each point should be:
- Clear and specific
- Action-oriented when applicable
- Include relevant context or data mentioned
- Prioritized by importance

### 3. Decisions Made (0-5 items)
Identify concrete decisions that were finalized during the meeting. Each decision should:
- State what was decided
- Include rationale if mentioned
- Note who made or approved the decision if specified
- Be actionable and unambiguous

### 4. Blockers & Issues (0-5 items)
List any obstacles, challenges, or concerns raised. Format as short phrases (2-5 words each):
- Resource constraints
- Technical challenges
- Dependencies
- Timeline concerns

### 5. Sentiment (1-2 words)
Assess the overall meeting tone: "Positive", "Constructive", "Neutral", "Challenging", "Collaborative", or "Productive"

### 6. Follow-ups (2-5 items)
Identify items requiring further discussion or investigation:
- Research needs
- Future meeting topics
- Questions to be answered
- Areas needing clarification

### 7. Action Items (2-8 items)
Extract specific, actionable tasks with:
- **title**: Clear, verb-based task description (e.g., "Review Q1 budget proposal", "Schedule follow-up with design team")
- **description**: Additional context, expected outcome, or deliverables (optional but recommended)
- **assigneeHint**: Suggested person or role mentioned (if any, e.g., "John from IT", "Marketing team lead")
- **dueDate**: Suggested deadline if mentioned (format: YYYY-MM-DD, otherwise null)

## Output Format
Return ONLY valid JSON matching this exact structure:

{
  "summary": "string",
  "discussionPoints": ["string", "string", ...],
  "decisions": ["string", "string", ...],
  "blockers": ["string", "string", ...],
  "sentiment": "string",
  "followUps": ["string", "string", ...],
  "actionItems": [
    {
      "title": "string",
      "description": "string or null",
      "assigneeHint": "string or null",
      "dueDate": "YYYY-MM-DD or null"
    }
  ]
}

## Quality Standards
- Use professional business language
- Be specific and concrete, avoid vague statements
- Focus on outcomes and actions, not just activities
- Prioritize information by business impact
- If minimal content is available, acknowledge it professionally in the summary

Generate the analysis now:`;

  const modelName = geminiModel();
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.3, 
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
            // Don't use responseMimeType for Gemini 2.5 - it's not supported
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("Gemini API error:", response.status, errorText);
      
      // Try with a different model if this one fails
      if (modelName !== "gemini-2.5-flash" && modelName !== "gemini-pro") {
        console.log("Retrying with fallback model: gemini-2.5-flash");
        const fallbackResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
            }),
          },
        );
        
        if (!fallbackResponse.ok) {
          throw new Error(`Gemini summary failed with ${response.status}. Fallback also failed with ${fallbackResponse.status}.`);
        }
        
        const fallbackPayload = await fallbackResponse.json();
        const fallbackText = fallbackPayload.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? "").join("\n") ?? "";
        const fallbackJsonText = extractJson(fallbackText);
        if (!fallbackJsonText) throw new Error("Gemini did not return valid JSON summary.");
        
        const fallbackParsed = JSON.parse(fallbackJsonText) as Partial<GeminiMeetingSummary>;
        return {
          summary: fallbackParsed.summary || "No summary returned.",
          discussionPoints: Array.isArray(fallbackParsed.discussionPoints) ? fallbackParsed.discussionPoints : [],
          decisions: Array.isArray(fallbackParsed.decisions) ? fallbackParsed.decisions : [],
          blockers: Array.isArray(fallbackParsed.blockers) ? fallbackParsed.blockers : [],
          sentiment: fallbackParsed.sentiment || "Neutral",
          followUps: Array.isArray(fallbackParsed.followUps) ? fallbackParsed.followUps : [],
          actionItems: Array.isArray(fallbackParsed.actionItems) ? fallbackParsed.actionItems : [],
        };
      }
      
      throw new Error(`Gemini API error ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    const jsonText = extractJson(text);
    
    if (!jsonText) {
      console.error("No JSON found in Gemini response:", text.substring(0, 500));
      throw new Error("Gemini did not return valid JSON. Response may be incomplete.");
    }

    const parsed = JSON.parse(jsonText) as Partial<GeminiMeetingSummary>;
    return {
      summary: parsed.summary || "Meeting analysis completed. Summary not generated.",
      discussionPoints: Array.isArray(parsed.discussionPoints) ? parsed.discussionPoints : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
      sentiment: parsed.sentiment || "Neutral",
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    };
  } catch (error) {
    console.error("Gemini summary generation failed:", error);
    throw error;
  }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const key = geminiKey();
  if (!key || !text.trim()) return null;
  const model = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "text-embedding-004";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  if (!response.ok) throw new Error(`Gemini embedding failed with ${response.status}.`);
  const payload = (await response.json()) as { embedding?: { values?: number[] } };
  return payload.embedding?.values ?? null;
}