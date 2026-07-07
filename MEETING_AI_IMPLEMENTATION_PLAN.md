# WorkSphere Meeting Intelligence Expansion Plan

This file is a handoff-ready implementation plan for expanding WorkSphere with manager meeting rooms, chat, document sharing, AI summaries, RAG, and admin live monitoring.

## Current Project Context

- App: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS.
- Database: Neon PostgreSQL through Prisma.
- Auth: custom signed HTTP-only session cookie plus Microsoft Entra ID SSO.
- Existing roles: Employee, Manager, Admin.
- Existing modules: goal creation, L1 approval, quarterly updates, check-ins, shared KPIs, audit logs, reports, analytics, notifications, escalation rules.
- Deployment: Vercel connected to GitHub.
- Current data access pattern: most business state is loaded through `src/app/api/state/route.ts`; authenticated server routes use `getSessionUser()` from `src/lib/auth.ts`.

## Target Feature

Add a Meeting Intelligence module where managers can run structured employee meetings connected to WorkSphere goals and check-ins.

Core features:

- Manager creates/schedules a meeting with selected employees.
- Employees join the meeting room.
- Meeting supports chat and document sharing.
- Video room is powered by LiveKit Cloud free tier.
- Meeting transcript, chat, and uploaded docs are processed by Gemini.
- AI produces summary, discussion points, decisions, blockers, sentiment, and action items.
- RAG search answers questions over meeting transcripts, chats, documents, and summaries.
- Admin dashboard shows active meetings, participants, duration, status, documents, and AI processing state.

## Free/Cheap Stack

- Video: LiveKit Cloud free tier.
- AI model: Gemini API via direct REST calls, no paid OpenAI dependency.
- Embeddings: Gemini embedding endpoint.
- Storage: Vercel Blob or UploadThing free tier for documents/recordings.
- Database: Neon PostgreSQL. Start with JSON/array embeddings for demo scale; optional pgvector upgrade later.
- RAG orchestration: lightweight custom retrieval first; add LangChain JS only if needed after the data model is stable.

## Six-To-Seven Day Delivery Plan

### Day 1: Data Model + Meeting Shell

Deliverables:

- Prisma models for meetings, participants, chat messages, documents, transcript segments, AI summaries, action items, and embedding chunks.
- API routes for listing meetings, creating meetings, joining/leaving meetings, and posting chat messages.
- UI navigation entries:
  - Manager: Meetings
  - Employee: Meetings
  - Admin: Live Meetings

Acceptance criteria:

- Manager can create a meeting with employees.
- Employee can see meetings assigned to them.
- Admin can see all meetings and their status.
- No video/AI dependency needed yet.

### Day 2: Meeting Room + Chat + Documents

Deliverables:

- Meeting room page/component inside the main app.
- Participant list, meeting status, start/end controls.
- Chat panel persisted in database.
- Document upload metadata model and UI. If storage is not ready, support URL-based document attachment first.

Acceptance criteria:

- Chat messages persist and reload.
- Documents are attached to meeting records.
- Admin can see documents shared per meeting.

### Day 3: LiveKit Video Integration

Deliverables:

- LiveKit token API route.
- LiveKit room naming convention: `worksphere-{meetingId}`.
- Video room component using LiveKit React package.
- Start/end meeting updates participants and meeting status.

Manual user steps:

- Create LiveKit Cloud project.
- Add `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL` to Vercel.

Acceptance criteria:

- Manager and employee can join the same video room.
- Participant join/leave status is tracked in WorkSphere.

### Day 4: Gemini Meeting Summary

Deliverables:

- `src/lib/gemini.ts` helper using fetch.
- Summary API route that uses meeting transcript/chat/docs.
- AI output stored in structured fields:
  - concise summary
  - key discussion points
  - decisions
  - blockers
  - action items
  - sentiment
  - follow-up recommendations

Manual user steps:

- Create Gemini API key.
- Add `GEMINI_API_KEY` to Vercel.

Acceptance criteria:

- Ended meeting can generate a useful AI summary.
- Summary is visible to manager, participating employees, and admin.

### Day 5: RAG + Meeting Q&A

Deliverables:

- Chunk meeting transcripts, chats, summaries, and document text.
- Generate Gemini embeddings.
- Store embedding chunks in database.
- Query API that embeds the question, retrieves top chunks, and asks Gemini to answer with sources.

Acceptance criteria:

- User can ask: “What blockers came up in my Q1 check-in meeting?”
- Admin can ask: “Which teams discussed delayed goal submissions?”
- Answers cite meeting/document chunks.

### Day 6: Admin Monitoring + Notifications

Deliverables:

- Admin live meeting dashboard.
- Filters by status, manager, department, date.
- Meeting audit events for create/start/join/leave/end/summary.
- Email notifications for meeting scheduled, started, ended, and action items.

Acceptance criteria:

- Admin can see active meetings and durations.
- Manager/employee receive relevant notifications.

### Day 7: Testing + Polish

Deliverables:

- Full walkthrough test:
  - manager schedules meeting
  - employee joins
  - chat/document added
  - meeting ended
  - AI summary generated
  - RAG Q&A works
  - admin dashboard reflects status
- Empty states, loading states, and failure messages.
- README update with setup steps and demo script.

## Environment Variables To Add Later

```env
GEMINI_API_KEY=
NEXT_PUBLIC_LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
MEETING_STORAGE_PROVIDER=vercel-blob
BLOB_READ_WRITE_TOKEN=
```

## Data Model Strategy

Meeting tables should be independent from the existing goal workflow but linked by user IDs and optional goal/check-in IDs.

Primary models:

- `Meeting`
- `MeetingParticipant`
- `MeetingMessage`
- `MeetingDocument`
- `MeetingTranscriptSegment`
- `MeetingSummary`
- `MeetingActionItem`
- `MeetingKnowledgeChunk`

RAG strategy:

- Store raw content in `MeetingKnowledgeChunk.content`.
- Store embedding vector as JSON initially to avoid provider-specific migration risk.
- Compute cosine similarity in server code for demo scale.
- Later upgrade to Neon `pgvector` for large-scale similarity search.

## Implementation Rules

- Do not disturb existing goal, approval, quarterly tracking, escalation, SSO, or analytics workflows.
- Use authenticated API routes and role checks.
- Manager can only manage meetings they own.
- Employee can only access meetings where they are a participant.
- Admin can view and govern all meetings.
- AI calls must fail gracefully if `GEMINI_API_KEY` is missing.
- Video calls must fail gracefully if LiveKit env vars are missing.

## Recommended Demo Story

1. Manager schedules “Q1 Goal Check-in” with two employees.
2. Employee joins meeting and sends chat updates.
3. Manager attaches agenda/performance notes.
4. Meeting ends.
5. Gemini generates summary, decisions, sentiment, and action items.
6. Admin opens Live Meetings dashboard and sees meeting history.
7. User asks RAG: “What action items came from Q1 check-ins?”

