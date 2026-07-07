# WorkSphere Meeting Intelligence - Complete Implementation Roadmap

## Project Status Summary

### ✅ COMPLETED (Day 1-2)
1. **Database Schema** - All meeting models added to Prisma schema
2. **Environment Variables** - Placeholders added to `.env.example`
3. **Gemini Helper** - `src/lib/gemini.ts` with summary & embedding functions
4. **Core Meeting API** - `/api/meetings` GET/POST (list & create meetings)
5. **Meeting Status API** - `/api/meetings/[meetingId]/status` (start/join/leave/end/cancel)
6. **Meeting Messages API** - `/api/meetings/[meetingId]/messages` (chat persistence)
7. **Meeting Documents API** - `/api/meetings/[meetingId]/documents` (attach docs/URLs)
8. **Migration File** - `prisma/migrations/20260707000000_meeting_intelligence/migration.sql`

### 🔄 IN PROGRESS / REMAINING
1. **Meeting UI Integration** - Add meeting views to main `page.tsx`
2. **LiveKit Video Integration** - Room token API + video components
3. **AI Summary Generation** - Endpoint + UI for post-meeting summaries
4. **RAG Q&A System** - Embedding generation + similarity search + query API
5. **Admin Live Dashboard** - Real-time meeting monitoring for admins
6. **Notifications** - Meeting lifecycle email/Teams notifications
7. **Production Migration** - Apply migration to Neon database

---

## Tech Stack (Free/Low-Cost Focus)

### Core Stack (Already in Place)
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (Node.js runtime)
- **Database**: Neon PostgreSQL (Free tier) + Prisma ORM
- **Auth**: HTTP-only signed session cookies + Microsoft Entra SSO
- **Deployment**: Vercel (already deployed)

### New Services Needed (All Free Tier)
| Service | Purpose | Free Tier | Setup Required |
|---------|---------|-----------|----------------|
| **Gemini API** | AI summaries, embeddings, Q&A | Yes (generous limits) | API key only |
| **LiveKit Cloud** | Video meetings, screen share | Yes (limited minutes) | Create project, get credentials |
| **Vercel Blob** (optional) | File storage for docs | Yes (limited storage) | Enable on Vercel |
| **Neon** | Vector storage (pgvector) | Yes (already using) | Enable extension |

---

## Estimated Timeline: 6-7 Days

### Day 3: Meeting UI Shell (CURRENT FOCUS)
**Goal**: Add meeting navigation and basic UI to existing WorkSphere portal

**Tasks**:
1. Add meeting state types to `page.tsx`
2. Add "Meetings" navigation for Manager/Employee
3. Add "Live Meetings" navigation for Admin
4. Create `MeetingListView` component
5. Create `MeetingRoomView` component with:
   - Participant list
   - Chat panel (connected to `/api/meetings/[id]/messages`)
   - Document attach panel (connected to `/api/meetings/[id]/documents`)
   - Start/Join/Leave/End buttons (connected to `/api/meetings/[id]/status`)
6. Add meeting state loading from `/api/meetings` GET
7. Add "Schedule Meeting" form for Manager/Admin

**Acceptance Criteria**:
- Manager can schedule a meeting with team members
- Employee can see assigned meetings
- Meeting room shows participant status, chat, and documents
- Admin can view all meetings

**Estimated Time**: 6-8 hours

---

### Day 4: LiveKit Video Integration
**Goal**: Add real-time video/audio to meeting rooms

**Prerequisites**:
1. User creates LiveKit Cloud account: https://cloud.livekit.io/
2. Get API credentials (API Key, API Secret, WebSocket URL)
3. Add to Vercel environment:
   ```
   LIVEKIT_API_KEY=APIfromLiveKit
   LIVEKIT_API_SECRET=SECRETfromLiveKit
   NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
   ```

**Tasks**:
1. Install LiveKit packages:
   ```bash
   npm install livekit-client @livekit/components-react livekit-server-sdk
   ```
2. Create `/api/meetings/[meetingId]/livekit-token` endpoint:
   - Generate JWT token for participant
   - Use `livekitRoomName` from meeting record
   - Include user identity and permissions
3. Create `VideoRoom` component:
   - Use `@livekit/components-react` `LiveKitRoom`
   - Connect video/audio tracks
   - Screen share button
   - Participant grid/tiles
4. Integrate `VideoRoom` into `MeetingRoomView`
5. Auto-join video when user clicks "Join Meeting"

**Acceptance Criteria**:
- Manager starts meeting → LiveKit room created
- Employee joins → sees host video/audio
- Screen sharing works
- Participant join/leave reflected in UI

**Estimated Time**: 6-8 hours

---

### Day 5: AI Meeting Summary
**Goal**: Generate intelligent summaries after meetings end

**Prerequisites**:
1. Get Gemini API key: https://aistudio.google.com/app/apikey
2. Add to Vercel environment:
   ```
   GEMINI_API_KEY=your_api_key_here
   GEMINI_MODEL=gemini-1.5-flash
   ```

**Tasks**:
1. Create `/api/meetings/[meetingId]/summary` POST endpoint:
   - Collect all meeting data:
     - `MeetingMessage` (chat)
     - `MeetingTranscriptSegment` (if any)
     - `MeetingDocument.textContent` (attached docs)
     - Meeting title/agenda
   - Call `generateMeetingSummary()` from `src/lib/gemini.ts`
   - Store result in `MeetingSummary` table
   - Extract action items → create `MeetingActionItem` records
   - Update `meeting.summaryStatus` to "GENERATED"
2. Auto-trigger summary when meeting status → "ENDED"
3. Create `MeetingSummaryView` component:
   - Show summary text
   - Show discussion points (bullets)
   - Show decisions (bullets)
   - Show blockers (badges)
   - Show sentiment (emoji + text)
   - Show action items with assignee hints
4. Add "Generate Summary" button (manual fallback)
5. Add "View Summary" tab in meeting room (appears after generation)

**Acceptance Criteria**:
- Meeting ends → summary auto-generates
- Summary includes all key elements
- Action items are parsed and stored
- Manager/participants can view summary
- Admin can see summary in monitoring dashboard

**Estimated Time**: 6-8 hours

---

### Day 6: RAG Search & Meeting Q&A
**Goal**: Enable semantic search over all meeting knowledge

**Prerequisites**: Gemini API key (same as Day 5)

**Tasks**:
1. **Embeddings Generation**:
   - Create `/api/meetings/[meetingId]/embed` POST endpoint
   - Chunk meeting content:
     - Each chat message → 1 chunk (already done in messages API)
     - Each document → 1 chunk (already done in documents API)
     - Transcript segments → chunk every 5 messages
     - Summary → chunk by discussion point
   - Call `generateEmbedding()` from `src/lib/gemini.ts`
   - Store in `MeetingKnowledgeChunk.embedding` (JSON array)
   - Auto-trigger after summary generation

2. **Similarity Search Helper** (`src/lib/rag.ts`):
   ```typescript
   export function cosineSimilarity(a: number[], b: number[]): number
   export async function searchMeetingKnowledge(query: string, limit: number)
   ```
   - Embed user query
   - Load all chunks from DB
   - Calculate cosine similarity in-memory (acceptable for demo scale)
   - Return top N chunks

3. **Q&A API** (`/api/meetings/query` POST):
   - Accept `{ question: string, meetingId?: string }`
   - If `meetingId`: filter chunks to that meeting
   - Get top 5 relevant chunks via similarity search
   - Build context prompt with chunks
   - Call Gemini with query + context
   - Return answer + source citations

4. **Q&A UI Component**:
   - Search bar in Meeting room view
   - Search bar in Admin dashboard (global search)
   - Show answer with source chunk references
   - Click source → jump to meeting/document

**Acceptance Criteria**:
- User asks: "What blockers came up in Q1 check-in meetings?"
- System returns answer with meeting citations
- Admin can search across all meetings
- Participant can search within their meeting

**Estimated Time**: 8-10 hours

---

### Day 7: Admin Live Dashboard & Notifications
**Goal**: Complete admin monitoring and lifecycle notifications

**Tasks**:
1. **Admin Live Meetings Dashboard**:
   - Add "Live Meetings" view to admin navigation
   - Table with columns:
     - Title
     - Host
     - Department
     - Status (badge: Scheduled/Live/Ended)
     - Participants (count + names on hover)
     - Duration (if live: calculate from startedAt)
     - Documents (count)
     - Summary Status (badge)
     - Actions (View, End if admin)
   - Filters: Status, Department, Date range
   - Auto-refresh every 30s for live meetings
   - Click row → open meeting room view (read-only for admin)

2. **Meeting Notifications** (extend `/api/notifications`):
   - Add meeting event handlers:
     - `MEETING_SCHEDULED` → notify participants
     - `MEETING_STARTED` → notify participants
     - `MEETING_ENDED` → notify participants + manager
     - `MEETING_SUMMARY_READY` → notify participants with summary link
     - `ACTION_ITEM_ASSIGNED` → notify assignee
   - Email template updates (if using Resend)
   - Teams webhook format (if using Teams)

3. **Notification Triggers**:
   - Update `/api/meetings` POST → trigger `MEETING_SCHEDULED`
   - Update `/api/meetings/[id]/status` POST → trigger start/end events
   - Update `/api/meetings/[id]/summary` POST → trigger summary ready

4. **Polish & Error Handling**:
   - Loading states for AI generation
   - Error messages for API failures
   - Empty states for no meetings
   - Graceful degradation if Gemini/LiveKit unavailable

**Acceptance Criteria**:
- Admin sees all active meetings with real-time status
- Participants receive notifications at key moments
- Action items trigger assignee notifications
- Dashboard auto-refreshes for live updates

**Estimated Time**: 6-8 hours

---

## Setup Instructions for User

### Step 1: Apply Database Migration
Before using meeting features on deployed Vercel app:

```bash
# Connect to Neon database
npx prisma migrate deploy
```

This applies the `20260707000000_meeting_intelligence` migration.

### Step 2: Get Free API Keys

#### Gemini API (Required for AI features)
1. Visit https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Create API key
4. Add to Vercel env: `GEMINI_API_KEY=your_key`

#### LiveKit Cloud (Required for video)
1. Visit https://cloud.livekit.io/
2. Sign up free account
3. Create new project
4. Copy credentials from project settings:
   - API Key
   - API Secret
   - WebSocket URL
5. Add to Vercel env:
   ```
   LIVEKIT_API_KEY=APIfromLiveKit
   LIVEKIT_API_SECRET=SECRETfromLiveKit
   NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
   ```

#### Vercel Blob (Optional for file uploads)
1. Go to Vercel project → Storage → Create Blob store
2. Auto-injects `BLOB_READ_WRITE_TOKEN`
3. Set `MEETING_STORAGE_PROVIDER=vercel-blob` in env

### Step 3: Redeploy
After adding env vars, trigger Vercel redeploy:
```bash
git commit --allow-empty -m "Trigger redeploy with meeting env vars"
git push
```

---

## Implementation Rules

### Code Style
- Match existing WorkSphere patterns (see `page.tsx`, `api/state/route.ts`)
- Use role-based access control: Employee, Manager, Admin
- Manager can only manage meetings with their team members
- Admin has global view
- Use authenticated `getSessionUser()` for all API routes
- Follow existing naming: camelCase for vars, PascalCase for types

### Database Patterns
- Use Prisma for all DB operations
- Create audit logs for meeting lifecycle events
- Store embeddings as JSON initially (pgvector migration later if needed)
- Use cascading deletes for meeting sub-records
- Index: `[meetingId, status]`, `[userId, status]`, `[department, scheduledAt]`

### Error Handling
- Graceful degradation if Gemini API unavailable
- Graceful degradation if LiveKit unavailable
- Show helpful error messages in UI
- Don't crash if migration not applied yet (show setup notice)

### Performance
- Load meeting list with pagination if >50 meetings
- Auto-refresh live dashboard every 30s (not on every render)
- Debounce chat input
- Chunk large documents before embedding

---

## Testing Checklist

### Manager Flow
- [ ] Create meeting with 2+ employees
- [ ] Start meeting
- [ ] Send chat message
- [ ] Attach document URL
- [ ] Join video room
- [ ] Screen share
- [ ] End meeting
- [ ] View generated summary
- [ ] See action items
- [ ] Search meeting content via RAG

### Employee Flow
- [ ] See assigned meetings
- [ ] Join meeting
- [ ] Send chat
- [ ] View attached documents
- [ ] Join video
- [ ] Leave meeting
- [ ] View summary after meeting ends
- [ ] Search own meeting history

### Admin Flow
- [ ] View Live Meetings dashboard
- [ ] Filter by status/department
- [ ] See participant counts
- [ ] View any meeting (read-only)
- [ ] See AI summary status
- [ ] Search across all meetings
- [ ] Force-end a meeting (if needed)

### Notification Flow
- [ ] Participant receives "Meeting scheduled" email
- [ ] Participant receives "Meeting started" notification
- [ ] Participant receives "Summary ready" notification
- [ ] Assignee receives "Action item assigned" notification

---

## Architecture Integration

### How Meetings Fit Into WorkSphere

```
WorkSphere Goal Tracking System
├── Goals Module (existing)
│   ├── Goal creation/approval
│   ├── Quarterly updates
│   └── Check-ins
│
└── NEW: Meeting Intelligence Module
    ├── Scheduled meetings linked to:
    │   - Cycle (optional FK)
    │   - Department
    │   - Manager (host)
    │   - Employees (participants)
    │
    ├── Meeting content:
    │   - Video/audio (LiveKit)
    │   - Chat messages
    │   - Shared documents
    │   - Transcripts (future)
    │
    ├── AI processing:
    │   - Post-meeting summary
    │   - Action item extraction
    │   - Sentiment analysis
    │
    └── RAG search:
        - Embeddings (Gemini)
        - Semantic search
        - Q&A with citations
```

### State Management Pattern

Meetings use **separate API routes** (not `/api/state`):
- Why: Meeting data is large and event-driven
- List meetings: `GET /api/meetings`
- Create meeting: `POST /api/meetings`
- Meeting actions: `POST /api/meetings/[id]/status`
- Chat: `POST /api/meetings/[id]/messages`
- Docs: `POST /api/meetings/[id]/documents`
- Summary: `POST /api/meetings/[id]/summary`
- Q&A: `POST /api/meetings/query`

Goals continue using existing `/api/state` save pattern.

---

## Handoff Context for Other LLMs

### Project Structure
```
/
├── src/
│   ├── app/
│   │   ├── page.tsx          ← MAIN UI (add meeting views here)
│   │   ├── api/
│   │   │   ├── meetings/     ← Meeting APIs (already created)
│   │   │   └── state/        ← Existing goal state API (don't touch)
│   ├── lib/
│   │   ├── auth.ts           ← getSessionUser() (use this)
│   │   ├── prisma.ts         ← DB client
│   │   └── gemini.ts         ← AI helper (already created)
│
├── prisma/
│   ├── schema.prisma         ← Meeting models added
│   └── migrations/
│       └── 20260707000000_meeting_intelligence/
│           └── migration.sql ← Apply with `prisma migrate deploy`
│
├── .env.example              ← Meeting env vars documented
└── MEETING_AI_IMPLEMENTATION_PLAN.md  ← Original plan
```

### Key Files to Modify
1. **`src/app/page.tsx`**: Add meeting UI components and state
2. **New files to create**:
   - `src/app/api/meetings/[meetingId]/livekit-token/route.ts`
   - `src/app/api/meetings/[meetingId]/summary/route.ts`
   - `src/app/api/meetings/[meetingId]/embed/route.ts`
   - `src/app/api/meetings/query/route.ts`
   - `src/lib/rag.ts`
   - `src/lib/livekit.ts` (optional helper)

### Authentication Pattern
```typescript
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  // Role-based filtering
  const where = sessionUser.role === "ADMIN"
    ? {} 
    : sessionUser.role === "MANAGER"
      ? { hostId: sessionUser.id }
      : { participants: { some: { userId: sessionUser.id } } };
  // ...
}
```

### Prisma Query Pattern
```typescript
import { prisma } from "@/lib/prisma";

const meeting = await prisma.meeting.findFirst({
  where: { id: meetingId },
  include: {
    host: true,
    participants: { include: { user: true } },
    messages: { include: { sender: true }, orderBy: { createdAt: "asc" } },
    documents: { orderBy: { createdAt: "desc" } },
    summaries: { orderBy: { createdAt: "desc" }, take: 1 },
  },
});
```

### Next Steps
If you're picking up from here:
1. Start with **Day 3** (Meeting UI Shell)
2. Read existing `page.tsx` structure to understand the pattern
3. Add meeting types to the type definitions section
4. Add "Meetings" to navigation array for Manager/Employee
5. Create `MeetingListView` component similar to existing views
6. Connect to `/api/meetings` GET/POST endpoints

---

## Cost Breakdown (Estimated for 100 users, 20 meetings/month)

| Service | Free Tier Limit | Projected Usage | Cost |
|---------|-----------------|-----------------|------|
| **Neon PostgreSQL** | 0.5 GB storage | ~200 MB (meetings) | $0 |
| **Gemini API** | 60 req/min, 1M tokens/day | ~500 summaries/month | $0 |
| **LiveKit Cloud** | 10k participant-minutes/month | ~5k minutes (25 min/meeting × 20) | $0 |
| **Vercel Hosting** | Existing deployment | No change | $0 |
| **Vercel Blob** | 1 GB storage (optional) | ~500 MB docs | $0 |
| **Total** | | | **$0** |

---

## Optional Future Enhancements (Beyond 7 Days)

1. **Real-time Transcript**: LiveKit → Deepgram/Whisper → live captions
2. **Recording Storage**: Export LiveKit recordings to Vercel Blob
3. **Advanced RAG**: Migrate to pgvector for faster similarity search
4. **Automatic Action Items**: AI detects commitments during meeting
5. **Meeting Templates**: Pre-fill agenda for "Q1 Check-in" vs "Goal Review"
6. **Calendar Integration**: Sync with Google Calendar/Outlook
7. **Meeting Analytics**: Average duration, participation rates, sentiment trends

---

## Success Metrics

After 7 days, you should have:
- ✅ Managers scheduling meetings with team members
- ✅ Employees joining video rooms
- ✅ Chat and document sharing working
- ✅ AI summaries generating automatically after meetings
- ✅ RAG search answering questions about meeting content
- ✅ Admin dashboard showing live meeting status
- ✅ Notifications sent at key lifecycle events
- ✅ Zero additional cost (all free tier services)

---

## Troubleshooting Guide

### Migration not applied
**Symptom**: "Table 'Meeting' does not exist"
**Fix**: Run `npx prisma migrate deploy` from terminal

### Gemini API fails
**Symptom**: "AI summary unavailable"
**Fix**: Check `GEMINI_API_KEY` in Vercel env vars, verify key is active

### LiveKit connection fails
**Symptom**: Video room doesn't load
**Fix**: 
1. Check `NEXT_PUBLIC_LIVEKIT_URL` starts with `wss://`
2. Verify `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` match LiveKit dashboard
3. Check browser console for WebSocket errors

### Embeddings fail
**Symptom**: RAG search returns no results
**Fix**: 
1. Verify embeddings generated (check `MeetingKnowledgeChunk.embedding` not null)
2. Run manual embed endpoint: `POST /api/meetings/[id]/embed`
3. Check Gemini API quota

### Performance issues
**Symptom**: Slow similarity search
**Fix**:
1. Limit chunk count (filter by date range)
2. Consider migrating to pgvector (requires Neon enable extension)
3. Add Redis cache for frequently searched queries

---

## Contact & Context

- **Project**: WorkSphere Goal Management Portal
- **Original Plan**: `MEETING_AI_IMPLEMENTATION_PLAN.md`
- **Current Status**: Day 2 complete (APIs + schema), Day 3 starting (UI)
- **Blocker**: None - all prerequisites met, ready for UI integration
- **Next Contributor**: Start with Day 3 tasks above

---

Generated: 2026-07-07 | Updated: After Day 2 completion
