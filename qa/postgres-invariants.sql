\set ON_ERROR_STOP on

-- Execute somente em um PostgreSQL descartável, após todas as migrations:
-- psql "$DATABASE_URL" -f qa/postgres-invariants.sql
-- Toda fixture é criada dentro de uma transação e revertida no final.

BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

-- A migration não pode apenas criar as tabelas: os dados legados também precisam
-- satisfazer as invariantes imediatamente após o deploy.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Tenant" t
    WHERE t."status" = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1
        FROM "ClientMembership" cm
        WHERE cm."tenantId" = t."id"
          AND cm."role" = 'CLIENT_ADMIN'
          AND cm."status" = 'ACTIVE'
      )
  ) THEN
    RAISE EXCEPTION 'migration deixou cliente ativo sem CLIENT_ADMIN ativo';
  END IF;

END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_sqlstate(command text, expected_state text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE command;
    RAISE EXCEPTION 'comando deveria falhar com SQLSTATE %, mas foi aceito: %', expected_state, command;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> expected_state THEN
      RAISE EXCEPTION 'SQLSTATE inesperado: esperado %, recebido %; comando: %; erro: %',
        expected_state, SQLSTATE, command, SQLERRM;
    END IF;
  END;
END;
$$;

INSERT INTO "Tenant" ("id", "name", "slug", "status", "updatedAt") VALUES
  ('10000000-0000-4000-8000-00000000000a', 'QA Tenant A', 'qa-invariants-a', 'ACTIVE', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-00000000000b', 'QA Tenant B', 'qa-invariants-b', 'ACTIVE', CURRENT_TIMESTAMP);

INSERT INTO "User" ("id", "tenantId", "email", "name", "passwordHash", "role", "status", "updatedAt") VALUES
  ('10000000-0000-4000-8000-00000000001a', '10000000-0000-4000-8000-00000000000a', 'qa-invariants-a@example.test', 'QA A', 'not-a-real-login-hash', 'PROJECT_USER', 'ACTIVE', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-00000000001b', '10000000-0000-4000-8000-00000000000b', 'qa-invariants-b@example.test', 'QA B', 'not-a-real-login-hash', 'PROJECT_USER', 'ACTIVE', CURRENT_TIMESTAMP);

-- RN-06: cadastro sem código cria uma identidade global pendente até que o
-- Super Admin defina sua primeira organização.
INSERT INTO "User" ("id", "tenantId", "email", "name", "passwordHash", "role", "status", "updatedAt") VALUES
  ('10000000-0000-4000-8000-00000000001c', NULL, 'qa-global-pending@example.test', 'QA Global Pending', 'not-a-real-login-hash', 'PROJECT_USER', 'PENDING_APPROVAL', CURRENT_TIMESTAMP);

-- A abertura para identidades pendentes não permite SUPER_ADMIN vinculado a
-- tenant no campo legado.
SELECT pg_temp.expect_sqlstate(
  $sql$INSERT INTO "User" ("tenantId", "email", "name", "passwordHash", "role", "status", "updatedAt")
       VALUES ('10000000-0000-4000-8000-00000000000a', 'qa-invalid-super@example.test',
               'QA Invalid Super', 'not-a-real-login-hash', 'SUPER_ADMIN', 'ACTIVE', CURRENT_TIMESTAMP)$sql$,
  '23514'
);

INSERT INTO "ClientMembership" ("id", "tenantId", "userId", "role", "status", "updatedAt") VALUES
  ('10000000-0000-4000-8000-00000000002a', '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000001a', 'CLIENT_ADMIN', 'ACTIVE', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-00000000002b', '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000001b', 'CLIENT_ADMIN', 'ACTIVE', CURRENT_TIMESTAMP);

INSERT INTO "Workspace" ("id", "tenantId", "name", "slug", "status", "isDefault", "updatedAt") VALUES
  ('10000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', 'QA WA1', 'qa-wa1', 'ACTIVE', true, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a', 'QA WA2', 'qa-wa2', 'ACTIVE', false, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-00000000000b', 'QA WB1', 'qa-wb1', 'ACTIVE', true, CURRENT_TIMESTAMP);

INSERT INTO "WorkspaceMembership" ("id", "tenantId", "workspaceId", "userId", "role", "status", "updatedAt") VALUES
  ('10000000-0000-4000-8000-0000000003a1', '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000001a', 'WORKSPACE_ADMIN', 'ACTIVE', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-0000000003b1', '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-00000000001b', 'WORKSPACE_ADMIN', 'ACTIVE', CURRENT_TIMESTAMP);

-- RN-03/RN-10: usuário B não pode ser membro de workspace A sem membership no cliente A.
SELECT pg_temp.expect_sqlstate(
  $sql$INSERT INTO "WorkspaceMembership" ("tenantId", "workspaceId", "userId", "role", "status", "updatedAt")
       VALUES ('10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-0000000000a1',
               '10000000-0000-4000-8000-00000000001b', 'WORKSPACE_MEMBER', 'ACTIVE', CURRENT_TIMESTAMP)$sql$,
  '23503'
);

INSERT INTO "Project" ("id", "tenantId", "workspaceId", "name", "slug", "status", "updatedAt") VALUES
  ('10000000-0000-4000-8000-0000000004a1', '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-0000000000a1', 'QA PA1', 'qa-pa1', 'ACTIVE', CURRENT_TIMESTAMP);

-- RN-11: workspace é uma pasta opcional; o projeto pode ser agrupado,
-- movido e desagrupado dentro da mesma organização.
UPDATE "Project"
SET "workspaceId" = '10000000-0000-4000-8000-0000000000a2'
WHERE "id" = '10000000-0000-4000-8000-0000000004a1';

UPDATE "Project"
SET "workspaceId" = NULL
WHERE "id" = '10000000-0000-4000-8000-0000000004a1';

INSERT INTO "Project" ("id", "tenantId", "workspaceId", "name", "slug", "status", "updatedAt") VALUES
  ('10000000-0000-4000-8000-0000000004a2', '10000000-0000-4000-8000-00000000000a', NULL, 'QA sem pasta', 'qa-sem-pasta', 'ACTIVE', CURRENT_TIMESTAMP);

-- Restaura a pasta para os testes de uso abaixo.
UPDATE "Project"
SET "workspaceId" = '10000000-0000-4000-8000-0000000000a1'
WHERE "id" = '10000000-0000-4000-8000-0000000004a1';

-- A organização do projeto continua imutável.
SELECT pg_temp.expect_sqlstate(
  $sql$UPDATE "Project"
       SET "tenantId" = '10000000-0000-4000-8000-00000000000b'
       WHERE "id" = '10000000-0000-4000-8000-0000000004a1'$sql$,
  '23514'
);

-- RN-11: tenant e workspace precisam formar o mesmo escopo já na criação.
SELECT pg_temp.expect_sqlstate(
  $sql$INSERT INTO "Project" ("tenantId", "workspaceId", "name", "slug", "status", "updatedAt")
       VALUES ('10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-0000000000b1',
               'QA cross tenant', 'qa-cross-tenant', 'ACTIVE', CURRENT_TIMESTAMP)$sql$,
  '23503'
);

INSERT INTO "Persona" ("id", "tenantId", "name", "data", "version", "status", "updatedAt") VALUES
  ('10000000-0000-4000-8000-0000000005a1', '10000000-0000-4000-8000-00000000000a', 'QA Persona A', '{"marker":"A-v1"}', 1, 'ACTIVE', CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-0000000005b1', '10000000-0000-4000-8000-00000000000b', 'QA Persona B', '{"marker":"B-v1"}', 1, 'ACTIVE', CURRENT_TIMESTAMP);

INSERT INTO "WorkspacePersona" ("tenantId", "workspaceId", "personaId") VALUES
  ('10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000005a1');

-- RN-10/RN-PORT-05: FK composta impede associação de ativo B a workspace A.
SELECT pg_temp.expect_sqlstate(
  $sql$INSERT INTO "WorkspacePersona" ("tenantId", "workspaceId", "personaId")
       VALUES ('10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-0000000000a1',
               '10000000-0000-4000-8000-0000000005b1')$sql$,
  '23503'
);

INSERT INTO "ProjectPersonaUsage" (
  "tenantId", "workspaceId", "projectId", "personaId", "snapshot", "version"
) VALUES (
  '10000000-0000-4000-8000-00000000000a',
  '10000000-0000-4000-8000-0000000000a1',
  '10000000-0000-4000-8000-0000000004a1',
  '10000000-0000-4000-8000-0000000005a1',
  '{"name":"QA Persona A","data":{"marker":"A-v1"}}',
  1
);

-- RN-PORT-04/RN-14: snapshots, auditoria e histórico são append-only.
SELECT pg_temp.expect_sqlstate(
  $sql$UPDATE "ProjectPersonaUsage" SET "version" = 2
       WHERE "projectId" = '10000000-0000-4000-8000-0000000004a1'$sql$,
  '42501'
);

INSERT INTO "AuditLog" (
  "tenantId", "actorId", "action", "targetType", "targetId", "scopeType", "scopeId"
) VALUES (
  '10000000-0000-4000-8000-00000000000a',
  '10000000-0000-4000-8000-00000000001a',
  'QA_TEST',
  'Persona',
  '10000000-0000-4000-8000-0000000005a1',
  'TENANT',
  '10000000-0000-4000-8000-00000000000a'
);

SELECT pg_temp.expect_sqlstate(
  $sql$DELETE FROM "AuditLog" WHERE "action" = 'QA_TEST'$sql$,
  '42501'
);

INSERT INTO "AssetAssociationHistory" (
  "tenantId", "workspaceId", "assetType", "assetId", "action", "actorId"
) VALUES (
  '10000000-0000-4000-8000-00000000000a',
  '10000000-0000-4000-8000-0000000000a1',
  'PERSONA',
  '10000000-0000-4000-8000-0000000005a1',
  'ASSOCIATED',
  '10000000-0000-4000-8000-00000000001a'
);

SELECT pg_temp.expect_sqlstate(
  $sql$DELETE FROM "AssetAssociationHistory"
       WHERE "assetId" = '10000000-0000-4000-8000-0000000005a1'$sql$,
  '42501'
);

-- RN-09/RN-PORT-04: depois de o projeto deixar de estar ativo e a associação ser
-- removida, o ativo pode ser excluído e o snapshot histórico precisa permanecer.
UPDATE "Project" SET "status" = 'ARCHIVED' WHERE "id" = '10000000-0000-4000-8000-0000000004a1';
DELETE FROM "WorkspacePersona" WHERE "personaId" = '10000000-0000-4000-8000-0000000005a1';
DELETE FROM "Persona" WHERE "id" = '10000000-0000-4000-8000-0000000005a1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "ProjectPersonaUsage"
    WHERE "projectId" = '10000000-0000-4000-8000-0000000004a1'
      AND "snapshot"->'data'->>'marker' = 'A-v1'
  ) THEN
    RAISE EXCEPTION 'snapshot histórico foi alterado/removido após exclusão do ativo';
  END IF;
END;
$$;

ROLLBACK;
\echo 'PASS: invariantes PostgreSQL verificadas; transação revertida.'
