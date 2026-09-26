-- Support plans on the team and a ticket system.
CREATE TYPE "SupportPlan" AS ENUM ('free', 'developer', 'standard', 'premium');
CREATE TYPE "TicketStatus" AS ENUM ('open', 'answered', 'closed');
CREATE TYPE "TicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');
ALTER TYPE "ResourceType" ADD VALUE 'support';
ALTER TABLE "Team" ADD COLUMN "supportPlan" "SupportPlan" NOT NULL DEFAULT 'free';
ALTER TABLE "Team" ADD COLUMN "supportPlanSince" TIMESTAMP(3);

CREATE TABLE "Ticket" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "number" SERIAL NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'open',
  "priority" "TicketPriority" NOT NULL DEFAULT 'normal',
  "plan" "SupportPlan" NOT NULL,
  "resource" TEXT,
  "createdById" TEXT,
  "firstResponseDueAt" TIMESTAMP(3),
  "firstRespondedAt" TIMESTAMP(3),
  "lastCustomerAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSupportAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Ticket_teamId_status_idx" ON "Ticket"("teamId", "status");
CREATE INDEX "Ticket_status_priority_createdAt_idx" ON "Ticket"("status", "priority", "createdAt");

CREATE TABLE "TicketMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "fromSupport" BOOLEAN NOT NULL DEFAULT false,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
