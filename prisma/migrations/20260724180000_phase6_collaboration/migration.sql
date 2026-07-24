-- Phase 6: Collaboration — Comments, Review Workflow, Notifications

-- NotificationType enum
CREATE TYPE "NotificationType" AS ENUM (
  'COMMENT_MENTION',
  'COMMENT_REPLY',
  'REVIEW_REQUESTED',
  'REVIEW_APPROVED',
  'REVIEW_ESCALATED',
  'REVIEW_RESET',
  'SKU_ASSIGNED',
  'ALERT_TRIGGERED'
);

-- CustomerSkuComment
CREATE TABLE "CustomerSkuComment" (
  "id"              TEXT         NOT NULL,
  "customerSkuId"   TEXT         NOT NULL,
  "authorId"        TEXT         NOT NULL,
  "body"            TEXT         NOT NULL,
  "parentCommentId" TEXT,
  "isEdited"        BOOLEAN      NOT NULL DEFAULT false,
  "editedAt"        TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  "deletedAt"       TIMESTAMP(3),

  CONSTRAINT "CustomerSkuComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerSkuComment_customerSkuId_createdAt_idx" ON "CustomerSkuComment"("customerSkuId", "createdAt");
CREATE INDEX "CustomerSkuComment_parentCommentId_idx" ON "CustomerSkuComment"("parentCommentId");

ALTER TABLE "CustomerSkuComment"
  ADD CONSTRAINT "CustomerSkuComment_customerSkuId_fkey"
    FOREIGN KEY ("customerSkuId") REFERENCES "CustomerSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerSkuComment"
  ADD CONSTRAINT "CustomerSkuComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerSkuComment"
  ADD CONSTRAINT "CustomerSkuComment_parentCommentId_fkey"
    FOREIGN KEY ("parentCommentId") REFERENCES "CustomerSkuComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notification
CREATE TABLE "Notification" (
  "id"         TEXT              NOT NULL,
  "userId"     TEXT              NOT NULL,
  "type"       "NotificationType" NOT NULL,
  "title"      TEXT              NOT NULL,
  "body"       TEXT,
  "entityType" TEXT,
  "entityId"   TEXT,
  "isRead"     BOOLEAN           NOT NULL DEFAULT false,
  "readAt"     TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
