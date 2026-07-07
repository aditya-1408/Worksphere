-- Meeting Intelligence expansion

CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "MeetingParticipantStatus" AS ENUM ('INVITED', 'JOINED', 'LEFT', 'DECLINED');
CREATE TYPE "MeetingDocumentStatus" AS ENUM ('ATTACHED', 'INDEXED', 'FAILED');
CREATE TYPE "MeetingSummaryStatus" AS ENUM ('PENDING', 'GENERATED', 'FAILED');

CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agenda" TEXT,
    "department" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "cycleId" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "livekitRoomName" TEXT,
    "recordingUrl" TEXT,
    "transcriptStatus" "MeetingSummaryStatus" NOT NULL DEFAULT 'PENDING',
    "summaryStatus" "MeetingSummaryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MeetingParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingMessage" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingDocument" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "textContent" TEXT,
    "status" "MeetingDocumentStatus" NOT NULL DEFAULT 'ATTACHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingTranscriptSegment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "speakerName" TEXT,
    "startSecond" INTEGER,
    "endSecond" INTEGER,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingTranscriptSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingSummary" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "status" "MeetingSummaryStatus" NOT NULL DEFAULT 'GENERATED',
    "summary" TEXT NOT NULL,
    "discussionPoints" JSONB NOT NULL,
    "decisions" JSONB NOT NULL,
    "blockers" JSONB NOT NULL,
    "sentiment" TEXT NOT NULL,
    "followUps" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingActionItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingActionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "embeddingModel" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Meeting_livekitRoomName_key" ON "Meeting"("livekitRoomName");
CREATE INDEX "Meeting_hostId_status_idx" ON "Meeting"("hostId", "status");
CREATE INDEX "Meeting_department_scheduledAt_idx" ON "Meeting"("department", "scheduledAt");
CREATE UNIQUE INDEX "MeetingParticipant_meetingId_userId_key" ON "MeetingParticipant"("meetingId", "userId");
CREATE INDEX "MeetingParticipant_userId_status_idx" ON "MeetingParticipant"("userId", "status");
CREATE INDEX "MeetingMessage_meetingId_createdAt_idx" ON "MeetingMessage"("meetingId", "createdAt");
CREATE INDEX "MeetingDocument_meetingId_status_idx" ON "MeetingDocument"("meetingId", "status");
CREATE INDEX "MeetingTranscriptSegment_meetingId_createdAt_idx" ON "MeetingTranscriptSegment"("meetingId", "createdAt");
CREATE INDEX "MeetingActionItem_meetingId_status_idx" ON "MeetingActionItem"("meetingId", "status");
CREATE INDEX "MeetingActionItem_assigneeId_status_idx" ON "MeetingActionItem"("assigneeId", "status");
CREATE INDEX "MeetingKnowledgeChunk_meetingId_sourceType_idx" ON "MeetingKnowledgeChunk"("meetingId", "sourceType");

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingMessage" ADD CONSTRAINT "MeetingMessage_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingMessage" ADD CONSTRAINT "MeetingMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingDocument" ADD CONSTRAINT "MeetingDocument_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingTranscriptSegment" ADD CONSTRAINT "MeetingTranscriptSegment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingSummary" ADD CONSTRAINT "MeetingSummary_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingKnowledgeChunk" ADD CONSTRAINT "MeetingKnowledgeChunk_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;