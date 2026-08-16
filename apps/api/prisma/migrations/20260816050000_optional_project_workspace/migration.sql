-- A workspace is an optional organizational folder for projects. Project
-- identity and project-level authorization belong to the organization.

-- Remove foreign keys that encoded workspace ownership into project-scoped data.
ALTER TABLE "ProjectFunctionalPermission" DROP CONSTRAINT "ProjectFunctionalPermission_workspaceId_tenantId_fkey";
ALTER TABLE "ProjectFunctionalPermission" DROP CONSTRAINT "ProjectFunctionalPermission_projectId_tenantId_workspaceId_fkey";
ALTER TABLE "ProjectFunctionalPermission" DROP CONSTRAINT "ProjectFunctionalPermission_workspaceId_userId_fkey";
ALTER TABLE "ProjectPersonaUsage" DROP CONSTRAINT "ProjectPersonaUsage_projectId_tenantId_workspaceId_fkey";
ALTER TABLE "ProjectQuestionnaireUsage" DROP CONSTRAINT "ProjectQuestionnaireUsage_projectId_tenantId_workspaceId_fkey";

-- Existing projects may have the same slug in different workspaces. Preserve
-- the oldest slug and deterministically rename only the duplicates before
-- enforcing organization-wide uniqueness.
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "tenantId", "slug"
    ORDER BY "createdAt", "id"
  ) AS occurrence
  FROM "Project"
)
UPDATE "Project" AS project
SET "slug" = 'project-' || replace(project."id"::text, '-', '')
FROM ranked
WHERE ranked."id" = project."id" AND ranked.occurrence > 1;

DROP INDEX "Project_workspaceId_slug_key";
DROP INDEX "Project_id_tenantId_workspaceId_key";
DROP INDEX "ProjectFunctionalPermission_tenantId_workspaceId_userId_idx";

ALTER TABLE "Project" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "ProjectPersonaUsage" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "ProjectQuestionnaireUsage" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "ProjectFunctionalPermission" DROP COLUMN "workspaceId";

CREATE UNIQUE INDEX "Project_tenantId_slug_key" ON "Project"("tenantId", "slug");
CREATE INDEX "ProjectFunctionalPermission_tenantId_userId_idx" ON "ProjectFunctionalPermission"("tenantId", "userId");

-- Project permissions are now tied to the organization membership, so they
-- remain valid when a project is filed, moved, or removed from a workspace.
ALTER TABLE "ProjectFunctionalPermission"
  ADD CONSTRAINT "ProjectFunctionalPermission_projectId_tenantId_fkey"
  FOREIGN KEY ("projectId", "tenantId") REFERENCES "Project"("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectFunctionalPermission"
  ADD CONSTRAINT "ProjectFunctionalPermission_tenantId_userId_fkey"
  FOREIGN KEY ("tenantId", "userId") REFERENCES "ClientMembership"("tenantId", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Usage snapshots retain the workspace that grouped the project at the time,
-- if one existed, while the authoritative project relation is organization-scoped.
ALTER TABLE "ProjectPersonaUsage"
  ADD CONSTRAINT "ProjectPersonaUsage_projectId_tenantId_fkey"
  FOREIGN KEY ("projectId", "tenantId") REFERENCES "Project"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectQuestionnaireUsage"
  ADD CONSTRAINT "ProjectQuestionnaireUsage_projectId_tenantId_fkey"
  FOREIGN KEY ("projectId", "tenantId") REFERENCES "Project"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Projects can move between folders, but never between organizations.
DROP TRIGGER "Project_workspace_immutable" ON "Project";
DROP FUNCTION reject_project_workspace_move();

CREATE FUNCTION reject_project_tenant_move() RETURNS trigger AS $$
BEGIN
  IF NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'project organization is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Project_tenant_immutable"
BEFORE UPDATE OF "tenantId" ON "Project"
FOR EACH ROW EXECUTE FUNCTION reject_project_tenant_move();
