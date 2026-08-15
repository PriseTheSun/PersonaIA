ALTER TABLE "WorkspaceMembership"
ADD COLUMN "inheritedFromClientAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "WorkspaceMembership" wm
SET "inheritedFromClientAdmin" = true
FROM "ClientMembership" cm
WHERE cm."tenantId" = wm."tenantId"
  AND cm."userId" = wm."userId"
  AND cm."role" = 'CLIENT_ADMIN'
  AND wm."role" = 'WORKSPACE_ADMIN';

CREATE INDEX "WorkspaceMembership_inherited_client_admin_idx"
ON "WorkspaceMembership"("tenantId", "userId", "inheritedFromClientAdmin");
