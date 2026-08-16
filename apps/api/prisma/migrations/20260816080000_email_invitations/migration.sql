CREATE TYPE "InvitationStatus" AS ENUM (
  'PENDING_DELIVERY',
  'SENT',
  'ACCEPTED',
  'REVOKED',
  'EXPIRED'
);

CREATE TABLE "Invitation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "role" "ClientRole" NOT NULL DEFAULT 'CLIENT_MEMBER',
  "projectId" UUID,
  "invitedById" UUID,
  "tokenHash" CHAR(64) NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING_DELIVERY',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invitation_expiry_check" CHECK ("expiresAt" > "createdAt")
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE UNIQUE INDEX "Invitation_active_tenant_email_key"
ON "Invitation"("tenantId", "email")
WHERE "status" IN ('PENDING_DELIVERY', 'SENT');
CREATE INDEX "Invitation_tenantId_status_createdAt_idx" ON "Invitation"("tenantId", "status", "createdAt");
CREATE INDEX "Invitation_tenantId_email_status_idx" ON "Invitation"("tenantId", "email", "status");
CREATE INDEX "Invitation_projectId_status_idx" ON "Invitation"("projectId", "status");

ALTER TABLE "Invitation"
ADD CONSTRAINT "Invitation_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invitation"
ADD CONSTRAINT "Invitation_projectId_tenantId_fkey"
FOREIGN KEY ("projectId", "tenantId") REFERENCES "Project"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invitation"
ADD CONSTRAINT "Invitation_invitedById_fkey"
FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
