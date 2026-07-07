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
  return process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
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

  const prompt = `You are an enterprise meeting intelligence assistant for WorkSphere.\nReturn only valid JSON with keys: summary, discussionPoints, decisions, blockers, sentiment, followUps, actionItems.\nEach list should be concise and practical. actionItems must be an array of objects with title, description, assigneeHint, dueDate.\n\nMeeting title: ${input.title}\nAgenda: ${input.agenda ?? "Not provided"}\n\nTranscript:\n${input.transcript || "No transcript provided."}\n\nChat:\n${input.chat || "No chat messages."}\n\nDocuments:\n${input.documents || "No document text."}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini summary failed with ${response.status}.`);
  }

  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
  const jsonText = extractJson(text);
  if (!jsonText) throw new Error("Gemini did not return JSON summary.");

  const parsed = JSON.parse(jsonText) as Partial<GeminiMeetingSummary>;
  return {
    summary: parsed.summary || "No summary returned.",
    discussionPoints: Array.isArray(parsed.discussionPoints) ? parsed.discussionPoints : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
    sentiment: parsed.sentiment || "Neutral",
    followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
  };
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