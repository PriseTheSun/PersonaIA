-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING_APPROVAL', 'INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ClientRole" AS ENUM ('CLIENT_ADMIN', 'CLIENT_MEMBER');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('WORKSPACE_ADMIN', 'WORKSPACE_MEMBER');

-- CreateEnum
CREATE TYPE "Feature" AS ENUM ('PERSONA', 'RESEARCH', 'SIMULATION', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('READ', 'WRITE', 'ADMIN');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('PERSONA', 'QUESTIONNAIRE');

-- CreateEnum
CREATE TYPE "AssociationAction" AS ENUM ('ASSOCIATED', 'DISASSOCIATED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RecordStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "RecordStatus" ADD VALUE 'INVITED';
ALTER TYPE "RecordStatus" ADD VALUE 'REMOVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'WORKSPACE_ADMIN';
ALTER TYPE "Role" ADD VALUE 'WORKSPACE_MEMBER';

-- DropForeignKey
ALTER TABLE "ProjectMembership" DROP CONSTRAINT "ProjectMembership_userId_tenantId_fkey";

DROP TRIGGER IF EXISTS "ProjectMembership_tenant_guard" ON "ProjectMembership";
DROP FUNCTION IF EXISTS enforce_membership_tenant();

-- DropIndex
DROP INDEX "Project_tenantId_slug_key";

-- DropIndex
DROP INDEX "Project_tenantId_status_idx";

-- DropIndex
DROP INDEX "User_id_tenantId_key";

DROP INDEX "Notification_recipientId_type_targetId_key";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "scopeId" UUID,
ADD COLUMN     "scopeType" VARCHAR(40);

-- Added nullable for the compatibility backfill below, then made mandatory.
ALTER TABLE "Project" ADD COLUMN "workspaceId" UUID;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "description" VARCHAR(1000),
ADD COLUMN     "segment" VARCHAR(120);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'PROJECT_USER';

-- CreateTable
CREATE TABLE "ClientMembership" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ClientRole" NOT NULL DEFAULT 'CLIENT_MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "description" VARCHAR(1000),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'WORKSPACE_MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspacePermission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "feature" "Feature" NOT NULL,
    "level" "PermissionLevel" NOT NULL,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspacePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFunctionalPermission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "feature" "Feature" NOT NULL,
    "level" "PermissionLevel" NOT NULL,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFunctionalPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspacePersona" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "personaId" UUID NOT NULL,
    "associatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disassociatedAt" TIMESTAMP(3),

    CONSTRAINT "WorkspacePersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceQuestionnaire" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "questionnaireId" UUID NOT NULL,
    "associatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disassociatedAt" TIMESTAMP(3),

    CONSTRAINT "WorkspaceQuestionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAssociationHistory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "assetId" UUID NOT NULL,
    "action" "AssociationAction" NOT NULL,
    "actorId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAssociationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPersonaUsage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "personaId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPersonaUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectQuestionnaireUsage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "questionnaireId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectQuestionnaireUsage_pkey" PRIMARY KEY ("id")
);

-- Compatibility data migration: one default workspace per existing tenant,
-- global identities linked by scoped memberships, and old projects anchored.
INSERT INTO "Workspace" ("id", "tenantId", "name", "slug", "description", "status", "isDefault", "updatedAt")
SELECT gen_random_uuid(), t."id", 'Workspace principal', 'principal',
       'Workspace criado automaticamente durante a migração multicliente.',
       CASE WHEN t."status" = 'ACTIVE' THEN 'ACTIVE'::"RecordStatus" ELSE 'ARCHIVED'::"RecordStatus" END,
       true, CURRENT_TIMESTAMP
FROM "Tenant" t;

UPDATE "Project" p
SET "workspaceId" = w."id"
FROM "Workspace" w
WHERE w."tenantId" = p."tenantId" AND w."isDefault" = true;

ALTER TABLE "Project" ALTER COLUMN "workspaceId" SET NOT NULL;

INSERT INTO "ClientMembership" ("id", "tenantId", "userId", "role", "status", "updatedAt")
SELECT gen_random_uuid(), u."tenantId", u."id",
       CASE WHEN u."role" = 'CLIENT_ADMIN' THEN 'CLIENT_ADMIN'::"ClientRole" ELSE 'CLIENT_MEMBER'::"ClientRole" END,
       CASE u."status"::text
         WHEN 'PENDING' THEN 'PENDING_APPROVAL'::"MembershipStatus"
         WHEN 'ACTIVE' THEN 'ACTIVE'::"MembershipStatus"
         WHEN 'SUSPENDED' THEN 'SUSPENDED'::"MembershipStatus"
         ELSE 'REMOVED'::"MembershipStatus"
       END,
       CURRENT_TIMESTAMP
FROM "User" u
WHERE u."tenantId" IS NOT NULL;

INSERT INTO "WorkspaceMembership" ("id", "tenantId", "workspaceId", "userId", "role", "status", "updatedAt")
SELECT gen_random_uuid(), cm."tenantId", w."id", cm."userId",
       CASE WHEN cm."role" = 'CLIENT_ADMIN' THEN 'WORKSPACE_ADMIN'::"WorkspaceRole" ELSE 'WORKSPACE_MEMBER'::"WorkspaceRole" END,
       cm."status", CURRENT_TIMESTAMP
FROM "ClientMembership" cm
JOIN "Workspace" w ON w."tenantId" = cm."tenantId" AND w."isDefault" = true;

-- CreateIndex
CREATE INDEX "ClientMembership_userId_status_idx" ON "ClientMembership"("userId", "status");

-- CreateIndex
CREATE INDEX "ClientMembership_tenantId_role_status_idx" ON "ClientMembership"("tenantId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMembership_tenantId_userId_key" ON "ClientMembership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMembership_id_tenantId_key" ON "ClientMembership"("id", "tenantId");

-- CreateIndex
CREATE INDEX "Workspace_tenantId_status_idx" ON "Workspace"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_tenantId_slug_key" ON "Workspace"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_id_tenantId_key" ON "Workspace"("id", "tenantId");

-- At most one workspace can be the initial/default workspace of a tenant.
CREATE UNIQUE INDEX "Workspace_one_default_per_tenant_key"
ON "Workspace"("tenantId") WHERE "isDefault" = true;

-- CreateIndex
CREATE INDEX "WorkspaceMembership_tenantId_userId_status_idx" ON "WorkspaceMembership"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceMembership_workspaceId_role_status_idx" ON "WorkspaceMembership"("workspaceId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMembership_id_tenantId_workspaceId_key" ON "WorkspaceMembership"("id", "tenantId", "workspaceId");

-- CreateIndex
CREATE INDEX "WorkspacePermission_tenantId_userId_idx" ON "WorkspacePermission"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePermission_workspaceId_userId_feature_key" ON "WorkspacePermission"("workspaceId", "userId", "feature");

-- CreateIndex
CREATE INDEX "ProjectFunctionalPermission_tenantId_workspaceId_userId_idx" ON "ProjectFunctionalPermission"("tenantId", "workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFunctionalPermission_projectId_userId_feature_key" ON "ProjectFunctionalPermission"("projectId", "userId", "feature");

-- CreateIndex
CREATE INDEX "Persona_tenantId_status_idx" ON "Persona"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_id_tenantId_key" ON "Persona"("id", "tenantId");

-- CreateIndex
CREATE INDEX "Questionnaire_tenantId_status_idx" ON "Questionnaire"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Questionnaire_id_tenantId_key" ON "Questionnaire"("id", "tenantId");

-- CreateIndex
CREATE INDEX "WorkspacePersona_tenantId_personaId_disassociatedAt_idx" ON "WorkspacePersona"("tenantId", "personaId", "disassociatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePersona_workspaceId_personaId_key" ON "WorkspacePersona"("workspaceId", "personaId");

-- CreateIndex
CREATE INDEX "WorkspaceQuestionnaire_tenantId_questionnaireId_disassociat_idx" ON "WorkspaceQuestionnaire"("tenantId", "questionnaireId", "disassociatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceQuestionnaire_workspaceId_questionnaireId_key" ON "WorkspaceQuestionnaire"("workspaceId", "questionnaireId");

-- CreateIndex
CREATE INDEX "AssetAssociationHistory_tenantId_workspaceId_assetType_asse_idx" ON "AssetAssociationHistory"("tenantId", "workspaceId", "assetType", "assetId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectPersonaUsage_tenantId_personaId_idx" ON "ProjectPersonaUsage"("tenantId", "personaId");

-- CreateIndex
CREATE INDEX "ProjectPersonaUsage_projectId_createdAt_idx" ON "ProjectPersonaUsage"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectQuestionnaireUsage_tenantId_questionnaireId_idx" ON "ProjectQuestionnaireUsage"("tenantId", "questionnaireId");

-- CreateIndex
CREATE INDEX "ProjectQuestionnaireUsage_projectId_createdAt_idx" ON "ProjectQuestionnaireUsage"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_scopeType_scopeId_createdAt_idx" ON "AuditLog"("scopeType", "scopeId", "createdAt");

CREATE UNIQUE INDEX "Notification_recipientId_tenantId_type_targetId_key"
ON "Notification"("recipientId", "tenantId", "type", "targetId");

-- CreateIndex
CREATE INDEX "Project_tenantId_workspaceId_status_idx" ON "Project"("tenantId", "workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_slug_key" ON "Project"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_tenantId_workspaceId_key" ON "Project"("id", "tenantId", "workspaceId");

-- AddForeignKey
ALTER TABLE "ClientMembership" ADD CONSTRAINT "ClientMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMembership" ADD CONSTRAINT "ClientMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_tenantId_fkey" FOREIGN KEY ("workspaceId", "tenantId") REFERENCES "Workspace"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "ClientMembership"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePermission" ADD CONSTRAINT "WorkspacePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePermission" ADD CONSTRAINT "WorkspacePermission_workspaceId_tenantId_fkey" FOREIGN KEY ("workspaceId", "tenantId") REFERENCES "Workspace"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePermission" ADD CONSTRAINT "WorkspacePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePermission" ADD CONSTRAINT "WorkspacePermission_workspaceId_userId_fkey" FOREIGN KEY ("workspaceId", "userId") REFERENCES "WorkspaceMembership"("workspaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_tenantId_fkey" FOREIGN KEY ("workspaceId", "tenantId") REFERENCES "Workspace"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "ClientMembership"("tenantId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFunctionalPermission" ADD CONSTRAINT "ProjectFunctionalPermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFunctionalPermission" ADD CONSTRAINT "ProjectFunctionalPermission_workspaceId_tenantId_fkey" FOREIGN KEY ("workspaceId", "tenantId") REFERENCES "Workspace"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFunctionalPermission" ADD CONSTRAINT "ProjectFunctionalPermission_projectId_tenantId_workspaceId_fkey" FOREIGN KEY ("projectId", "tenantId", "workspaceId") REFERENCES "Project"("id", "tenantId", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFunctionalPermission" ADD CONSTRAINT "ProjectFunctionalPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFunctionalPermission" ADD CONSTRAINT "ProjectFunctionalPermission_workspaceId_userId_fkey" FOREIGN KEY ("workspaceId", "userId") REFERENCES "WorkspaceMembership"("workspaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePersona" ADD CONSTRAINT "WorkspacePersona_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePersona" ADD CONSTRAINT "WorkspacePersona_workspaceId_tenantId_fkey" FOREIGN KEY ("workspaceId", "tenantId") REFERENCES "Workspace"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePersona" ADD CONSTRAINT "WorkspacePersona_personaId_tenantId_fkey" FOREIGN KEY ("personaId", "tenantId") REFERENCES "Persona"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceQuestionnaire" ADD CONSTRAINT "WorkspaceQuestionnaire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceQuestionnaire" ADD CONSTRAINT "WorkspaceQuestionnaire_workspaceId_tenantId_fkey" FOREIGN KEY ("workspaceId", "tenantId") REFERENCES "Workspace"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceQuestionnaire" ADD CONSTRAINT "WorkspaceQuestionnaire_questionnaireId_tenantId_fkey" FOREIGN KEY ("questionnaireId", "tenantId") REFERENCES "Questionnaire"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssociationHistory" ADD CONSTRAINT "AssetAssociationHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssociationHistory" ADD CONSTRAINT "AssetAssociationHistory_workspaceId_tenantId_fkey" FOREIGN KEY ("workspaceId", "tenantId") REFERENCES "Workspace"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssociationHistory" ADD CONSTRAINT "AssetAssociationHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPersonaUsage" ADD CONSTRAINT "ProjectPersonaUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPersonaUsage" ADD CONSTRAINT "ProjectPersonaUsage_workspaceId_tenantId_fkey" FOREIGN KEY ("workspaceId", "tenantId") REFERENCES "Workspace"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPersonaUsage" ADD CONSTRAINT "ProjectPersonaUsage_projectId_tenantId_workspaceId_fkey" FOREIGN KEY ("projectId", "tenantId", "workspaceId") REFERENCES "Project"("id", "tenantId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuestionnaireUsage" ADD CONSTRAINT "ProjectQuestionnaireUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuestionnaireUsage" ADD CONSTRAINT "ProjectQuestionnaireUsage_workspaceId_tenantId_fkey" FOREIGN KEY ("workspaceId", "tenantId") REFERENCES "Workspace"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectQuestionnaireUsage" ADD CONSTRAINT "ProjectQuestionnaireUsage_projectId_tenantId_workspaceId_fkey" FOREIGN KEY ("projectId", "tenantId", "workspaceId") REFERENCES "Project"("id", "tenantId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Projects never move between workspaces (RN-11).
CREATE OR REPLACE FUNCTION reject_project_workspace_move() RETURNS trigger AS $$
BEGIN
  IF NEW."workspaceId" IS DISTINCT FROM OLD."workspaceId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'project workspace and tenant are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Project_workspace_immutable"
BEFORE UPDATE OF "workspaceId", "tenantId" ON "Project"
FOR EACH ROW EXECUTE FUNCTION reject_project_workspace_move();

-- Sensitive histories and snapshots are append-only at the database boundary.
CREATE OR REPLACE FUNCTION reject_append_only_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "AssetAssociationHistory_append_only"
BEFORE UPDATE OR DELETE ON "AssetAssociationHistory"
FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "ProjectPersonaUsage_append_only"
BEFORE UPDATE OR DELETE ON "ProjectPersonaUsage"
FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "ProjectQuestionnaireUsage_append_only"
BEFORE UPDATE OR DELETE ON "ProjectQuestionnaireUsage"
FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();
