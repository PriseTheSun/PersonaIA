ALTER TABLE "ClientMembership"
ADD COLUMN "requestedProjectId" UUID;

CREATE INDEX "ClientMembership_tenantId_requestedProjectId_status_idx"
ON "ClientMembership"("tenantId", "requestedProjectId", "status");

ALTER TABLE "ClientMembership"
ADD CONSTRAINT "ClientMembership_requestedProjectId_tenantId_fkey"
FOREIGN KEY ("requestedProjectId", "tenantId")
REFERENCES "Project"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prevent repeated logins from flooding the same administrators while the
-- user still has no project access. A new notification becomes possible after
-- the previous one is resolved.
CREATE UNIQUE INDEX "Notification_open_missing_project_key"
ON "Notification"("recipientId", "tenantId", "type", "targetId")
WHERE "type" = 'USER_LOGIN_WITHOUT_PROJECT' AND "resolvedAt" IS NULL;
