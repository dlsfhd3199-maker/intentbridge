-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT;

-- CreateTable
CREATE TABLE "MutationReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payloadHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MutationReceipt_expiresAt_idx" ON "MutationReceipt"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "AdvertiserMember_advertiserId_idx" ON "AdvertiserMember"("advertiserId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Invitation_userId_expiresAt_idx" ON "Invitation"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE INDEX "User_status_role_idx" ON "User"("status", "role");
