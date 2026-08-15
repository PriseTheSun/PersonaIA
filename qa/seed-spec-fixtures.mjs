import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const databaseUrl = process.env.QA_DATABASE_URL;
const confirmation = process.env.PERSONAIA_QA_RESET;
const expectedConfirmation = 'I_UNDERSTAND_THIS_ISOLATED_QA';
if (!databaseUrl) throw new Error('Defina QA_DATABASE_URL para um banco PostgreSQL isolado.');
if (confirmation !== expectedConfirmation) {
  throw new Error(`Defina PERSONAIA_QA_RESET=${expectedConfirmation} para autorizar o reset da fixture.`);
}

const parsedUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
if (!databaseName.endsWith('_qa')) {
  throw new Error(`Banco recusado: "${databaseName}" não termina em "_qa".`);
}
if ((parsedUrl.searchParams.get('schema') ?? 'public') !== 'public') {
  throw new Error('A fixture aceita somente o schema public de um banco isolado.');
}

process.env.DATABASE_URL = databaseUrl;
const requireFromApi = createRequire(resolve('apps/api/package.json'));
const { PrismaClient } = requireFromApi('@prisma/client');
const argon2 = requireFromApi('argon2');
const prisma = new PrismaClient();

const PASSWORD = process.env.QA_FIXTURE_PASSWORD ?? 'QA-Fixture-Pass-2026!';
const WRONG_PASSWORD = 'QA-Fixture-Wrong-2026!';
if (PASSWORD === WRONG_PASSWORD || PASSWORD.length < 16) {
  throw new Error('QA_FIXTURE_PASSWORD deve ter ao menos 16 caracteres e ser diferente da senha errada.');
}

const ids = {
  tenantA: '00000000-0000-4000-8000-00000000000a',
  tenantB: '00000000-0000-4000-8000-00000000000b',
  workspaceA1: '00000000-0000-4000-8000-0000000000a1',
  workspaceA2: '00000000-0000-4000-8000-0000000000a2',
  workspaceB1: '00000000-0000-4000-8000-0000000000b1',
  projectA1: '00000000-0000-4000-8000-0000000001a1',
  projectA2: '00000000-0000-4000-8000-0000000001a2',
  projectB1: '00000000-0000-4000-8000-0000000001b1',
  personaA: '00000000-0000-4000-8000-0000000002a1',
  personaB: '00000000-0000-4000-8000-0000000002b1',
  questionnaireA: '00000000-0000-4000-8000-0000000003a1',
  questionnaireB: '00000000-0000-4000-8000-0000000003b1',
  revocableMemberA: '00000000-0000-4000-8000-0000000004a1',
  workspaceMemberA: '00000000-0000-4000-8000-0000000004a2',
  clientAdminA2: '00000000-0000-4000-8000-0000000004a3',
};

const userIds = {
  superAdmin: '00000000-0000-4000-8000-000000000601',
  superAdmin2: '00000000-0000-4000-8000-000000000610',
  clientAdminA: '00000000-0000-4000-8000-000000000602',
  clientAdminA2: ids.clientAdminA2,
  clientAdminB: '00000000-0000-4000-8000-000000000604',
  workspaceMemberA: ids.workspaceMemberA,
  revocableMemberA: ids.revocableMemberA,
  denyMemberA: '00000000-0000-4000-8000-000000000607',
  multiClientUser: '00000000-0000-4000-8000-000000000608',
  existingIdentityNotInB: '00000000-0000-4000-8000-000000000609',
  suspendedIdentity: '00000000-0000-4000-8000-0000000006a1',
  suspendedMembershipIdentity: '00000000-0000-4000-8000-0000000006a2',
  crossTenantGrantMember: '00000000-0000-4000-8000-0000000006a3',
  pendingApproval: '00000000-0000-4000-8000-00000000060d',
  noAssetReadMemberA: '00000000-0000-4000-8000-00000000060e',
  limitedAssetReadMemberA: '00000000-0000-4000-8000-00000000060f',
  raceClientAdmin1: '00000000-0000-4000-8000-0000000005a1',
  raceClientAdmin2: '00000000-0000-4000-8000-0000000005a2',
  raceWorkspaceAdmin1: '00000000-0000-4000-8000-0000000005b1',
  raceWorkspaceAdmin2: '00000000-0000-4000-8000-0000000005b2',
  raceWorkspaceClientAdmin: '00000000-0000-4000-8000-0000000005e1',
};

const race = {
  tenantId: '00000000-0000-4000-8000-00000000005a',
  tenantWorkspaceId: '00000000-0000-4000-8000-00000000005c',
  workspaceTenantId: '00000000-0000-4000-8000-00000000005d',
  workspaceId: '00000000-0000-4000-8000-00000000005b',
};

const accounts = {
  superAdmin: ['qa-super@example.test', 'QA Super Admin', 'SUPER_ADMIN', 'ACTIVE', null],
  superAdmin2: ['qa-super-2@example.test', 'QA Super Admin 2', 'SUPER_ADMIN', 'ACTIVE', null],
  clientAdminA: ['qa-admin-a@example.test', 'QA Admin A', 'CLIENT_ADMIN', 'ACTIVE', ids.tenantA],
  clientAdminA2: ['qa-admin-a2@example.test', 'QA Admin A2', 'CLIENT_ADMIN', 'ACTIVE', ids.tenantA],
  clientAdminB: ['qa-admin-b@example.test', 'QA Admin B', 'CLIENT_ADMIN', 'ACTIVE', ids.tenantB],
  workspaceMemberA: ['qa-member-a@example.test', 'QA Member A', 'PROJECT_USER', 'ACTIVE', ids.tenantA],
  revocableMemberA: ['qa-revocable-a@example.test', 'QA Revocable A', 'PROJECT_USER', 'ACTIVE', ids.tenantA],
  denyMemberA: ['qa-deny-a@example.test', 'QA Deny A', 'PROJECT_USER', 'ACTIVE', ids.tenantA],
  multiClientUser: ['qa-multi@example.test', 'QA Multi-client', 'PROJECT_USER', 'ACTIVE', ids.tenantA],
  existingIdentityNotInB: ['qa-existing@example.test', 'QA Existing Identity', 'PROJECT_USER', 'ACTIVE', ids.tenantA],
  suspendedIdentity: ['qa-suspended@example.test', 'QA Suspended Identity', 'PROJECT_USER', 'SUSPENDED', ids.tenantA],
  suspendedMembershipIdentity: ['qa-suspended-membership@example.test', 'QA Suspended Membership', 'PROJECT_USER', 'SUSPENDED', ids.tenantA],
  crossTenantGrantMember: ['qa-cross-grant@example.test', 'QA Cross Grant', 'PROJECT_USER', 'ACTIVE', ids.tenantA],
  pendingApproval: ['qa-pending@example.test', 'QA Pending', 'PROJECT_USER', 'PENDING_APPROVAL', ids.tenantA],
  noAssetReadMemberA: ['qa-no-asset-read-a@example.test', 'QA No Asset Read', 'PROJECT_USER', 'ACTIVE', ids.tenantA],
  limitedAssetReadMemberA: ['qa-limited-asset-read-a@example.test', 'QA Limited Asset Read', 'PROJECT_USER', 'ACTIVE', ids.tenantA],
  raceClientAdmin1: ['qa-race-client-1@example.test', 'QA Race Client 1', 'PROJECT_USER', 'ACTIVE', race.tenantId],
  raceClientAdmin2: ['qa-race-client-2@example.test', 'QA Race Client 2', 'PROJECT_USER', 'ACTIVE', race.tenantId],
  raceWorkspaceAdmin1: ['qa-race-workspace-1@example.test', 'QA Race Workspace 1', 'PROJECT_USER', 'ACTIVE', race.workspaceTenantId],
  raceWorkspaceAdmin2: ['qa-race-workspace-2@example.test', 'QA Race Workspace 2', 'PROJECT_USER', 'ACTIVE', race.workspaceTenantId],
  raceWorkspaceClientAdmin: ['qa-race-workspace-client@example.test', 'QA Race Workspace Client', 'PROJECT_USER', 'ACTIVE', race.workspaceTenantId],
};

const passwordHash = await argon2.hash(PASSWORD, {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
});

try {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    "Notification", "AuditLog", "RefreshSession", "ProjectPersonaUsage",
    "ProjectQuestionnaireUsage", "AssetAssociationHistory", "WorkspacePersona",
    "WorkspaceQuestionnaire", "ProjectFunctionalPermission", "WorkspacePermission",
    "ProjectMembership", "WorkspaceMembership", "ClientMembership", "Persona",
    "Questionnaire", "Project", "Workspace", "User", "Tenant"
    RESTART IDENTITY CASCADE`);

  await prisma.tenant.createMany({ data: [
    { id: ids.tenantA, name: 'QA Tenant A', slug: 'qa-tenant-a', segment: 'QA', description: 'QA_SENTINEL_TENANT_A', status: 'ACTIVE' },
    { id: ids.tenantB, name: 'QA Tenant B', slug: 'qa-tenant-b', segment: 'QA', description: 'QA_SENTINEL_TENANT_B', status: 'ACTIVE' },
    { id: race.tenantId, name: 'QA Race Tenant', slug: 'qa-race-tenant', segment: 'QA', status: 'ACTIVE' },
    { id: race.workspaceTenantId, name: 'QA Workspace Race Tenant', slug: 'qa-workspace-race-tenant', segment: 'QA', status: 'ACTIVE' },
  ] });

  await prisma.user.createMany({ data: Object.entries(accounts).map(([key, account]) => ({
    id: userIds[key],
    email: account[0],
    name: account[1],
    role: account[2],
    status: account[3],
    tenantId: account[4],
    passwordHash,
  })) });

  await prisma.clientMembership.createMany({ data: [
    { tenantId: ids.tenantA, userId: userIds.clientAdminA, role: 'CLIENT_ADMIN', status: 'ACTIVE' },
    { tenantId: ids.tenantA, userId: userIds.clientAdminA2, role: 'CLIENT_ADMIN', status: 'ACTIVE' },
    { tenantId: ids.tenantB, userId: userIds.clientAdminB, role: 'CLIENT_ADMIN', status: 'ACTIVE' },
    ...['workspaceMemberA', 'revocableMemberA', 'denyMemberA', 'multiClientUser', 'existingIdentityNotInB', 'crossTenantGrantMember', 'noAssetReadMemberA', 'limitedAssetReadMemberA'].map((key) => ({
      tenantId: ids.tenantA, userId: userIds[key], role: 'CLIENT_MEMBER', status: 'ACTIVE',
    })),
    { tenantId: ids.tenantB, userId: userIds.multiClientUser, role: 'CLIENT_MEMBER', status: 'ACTIVE' },
    { tenantId: ids.tenantA, userId: userIds.pendingApproval, role: 'CLIENT_MEMBER', status: 'PENDING_APPROVAL' },
    { tenantId: race.tenantId, userId: userIds.raceClientAdmin1, role: 'CLIENT_ADMIN', status: 'ACTIVE' },
    { tenantId: race.tenantId, userId: userIds.raceClientAdmin2, role: 'CLIENT_ADMIN', status: 'ACTIVE' },
    { tenantId: race.workspaceTenantId, userId: userIds.raceWorkspaceClientAdmin, role: 'CLIENT_ADMIN', status: 'ACTIVE' },
    { tenantId: race.workspaceTenantId, userId: userIds.raceWorkspaceAdmin1, role: 'CLIENT_MEMBER', status: 'ACTIVE' },
    { tenantId: race.workspaceTenantId, userId: userIds.raceWorkspaceAdmin2, role: 'CLIENT_MEMBER', status: 'ACTIVE' },
  ] });

  await prisma.workspace.createMany({ data: [
    { id: ids.workspaceA1, tenantId: ids.tenantA, name: 'QA Workspace A1', slug: 'qa-workspace-a1', description: 'QA_SENTINEL_TENANT_A', isDefault: true },
    { id: ids.workspaceA2, tenantId: ids.tenantA, name: 'QA Workspace A2', slug: 'qa-workspace-a2', description: 'QA_WORKSPACE_A2_PRIVATE' },
    { id: ids.workspaceB1, tenantId: ids.tenantB, name: 'QA Workspace B1', slug: 'qa-workspace-b1', description: 'QA_SENTINEL_TENANT_B', isDefault: true },
    { id: race.tenantWorkspaceId, tenantId: race.tenantId, name: 'QA Race Default', slug: 'qa-race-default', isDefault: true },
    { id: race.workspaceId, tenantId: race.workspaceTenantId, name: 'QA Workspace Admin Race', slug: 'qa-workspace-admin-race', isDefault: true },
  ] });

  await prisma.workspaceMembership.createMany({ data: [
    ...[userIds.clientAdminA, userIds.clientAdminA2].flatMap((userId) => [ids.workspaceA1, ids.workspaceA2].map((workspaceId) => ({
      tenantId: ids.tenantA, workspaceId, userId, role: 'WORKSPACE_ADMIN', status: 'ACTIVE',
    }))),
    { tenantId: ids.tenantB, workspaceId: ids.workspaceB1, userId: userIds.clientAdminB, role: 'WORKSPACE_ADMIN', status: 'ACTIVE' },
    ...['workspaceMemberA', 'revocableMemberA', 'existingIdentityNotInB', 'crossTenantGrantMember', 'noAssetReadMemberA', 'limitedAssetReadMemberA'].map((key) => ({
      tenantId: ids.tenantA, workspaceId: ids.workspaceA1, userId: userIds[key], role: 'WORKSPACE_MEMBER', status: 'ACTIVE',
    })),
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, userId: userIds.multiClientUser, role: 'WORKSPACE_MEMBER', status: 'ACTIVE' },
    { tenantId: ids.tenantB, workspaceId: ids.workspaceB1, userId: userIds.multiClientUser, role: 'WORKSPACE_MEMBER', status: 'ACTIVE' },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, userId: userIds.denyMemberA, role: 'WORKSPACE_MEMBER', status: 'ACTIVE' },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA2, userId: userIds.denyMemberA, role: 'WORKSPACE_MEMBER', status: 'ACTIVE' },
    { tenantId: race.tenantId, workspaceId: race.tenantWorkspaceId, userId: userIds.raceClientAdmin1, role: 'WORKSPACE_ADMIN', status: 'ACTIVE' },
    { tenantId: race.tenantId, workspaceId: race.tenantWorkspaceId, userId: userIds.raceClientAdmin2, role: 'WORKSPACE_ADMIN', status: 'ACTIVE' },
    { tenantId: race.workspaceTenantId, workspaceId: race.workspaceId, userId: userIds.raceWorkspaceAdmin1, role: 'WORKSPACE_ADMIN', status: 'ACTIVE' },
    { tenantId: race.workspaceTenantId, workspaceId: race.workspaceId, userId: userIds.raceWorkspaceAdmin2, role: 'WORKSPACE_ADMIN', status: 'ACTIVE' },
  ] });

  await prisma.workspacePermission.createMany({ data: [
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, userId: userIds.workspaceMemberA, feature: 'PERSONA', level: 'WRITE', effect: 'ALLOW' },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, userId: userIds.denyMemberA, feature: 'PERSONA', level: 'ADMIN', effect: 'ALLOW' },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA2, userId: userIds.denyMemberA, feature: 'PERSONA', level: 'ADMIN', effect: 'ALLOW' },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, userId: userIds.noAssetReadMemberA, feature: 'PERSONA', level: 'ADMIN', effect: 'DENY' },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, userId: userIds.noAssetReadMemberA, feature: 'RESEARCH', level: 'ADMIN', effect: 'DENY' },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, userId: userIds.limitedAssetReadMemberA, feature: 'PERSONA', level: 'READ', effect: 'ALLOW' },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, userId: userIds.limitedAssetReadMemberA, feature: 'RESEARCH', level: 'READ', effect: 'ALLOW' },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, userId: userIds.multiClientUser, feature: 'DASHBOARD', level: 'READ', effect: 'ALLOW' },
    { tenantId: ids.tenantB, workspaceId: ids.workspaceB1, userId: userIds.multiClientUser, feature: 'DASHBOARD', level: 'READ', effect: 'ALLOW' },
  ] });

  await prisma.project.createMany({ data: [
    { id: ids.projectA1, tenantId: ids.tenantA, workspaceId: ids.workspaceA1, name: 'QA Project A1', slug: 'qa-project-a1', description: 'QA_SENTINEL_TENANT_A' },
    { id: ids.projectA2, tenantId: ids.tenantA, workspaceId: ids.workspaceA2, name: 'QA Project A2', slug: 'qa-project-a2', description: 'QA_WORKSPACE_A2_PRIVATE' },
    { id: ids.projectB1, tenantId: ids.tenantB, workspaceId: ids.workspaceB1, name: 'QA Project B1', slug: 'qa-project-b1', description: 'QA_SENTINEL_TENANT_B' },
  ] });

  await prisma.projectFunctionalPermission.create({ data: {
    tenantId: ids.tenantA,
    workspaceId: ids.workspaceA1,
    projectId: ids.projectA1,
    userId: userIds.denyMemberA,
    feature: 'PERSONA',
    level: 'ADMIN',
    effect: 'DENY',
  } });

  await prisma.persona.createMany({ data: [
    { id: ids.personaA, tenantId: ids.tenantA, name: 'QA Persona A', description: 'QA_PERSONA_A_SENTINEL', data: { profile: 'tenant-a-v1' }, version: 1 },
    { id: ids.personaB, tenantId: ids.tenantB, name: 'QA Persona B', description: 'QA_PERSONA_B_SENTINEL', data: { profile: 'tenant-b-v1' }, version: 1 },
  ] });
  await prisma.questionnaire.createMany({ data: [
    { id: ids.questionnaireA, tenantId: ids.tenantA, name: 'QA Questionnaire A', description: 'QA_QUESTIONNAIRE_A_SENTINEL', data: { questions: ['A?'] }, version: 1 },
    { id: ids.questionnaireB, tenantId: ids.tenantB, name: 'QA Questionnaire B', description: 'QA_QUESTIONNAIRE_B_SENTINEL', data: { questions: ['B?'] }, version: 1 },
  ] });

  await prisma.workspacePersona.createMany({ data: [
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, personaId: ids.personaA },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA2, personaId: ids.personaA },
    { tenantId: ids.tenantB, workspaceId: ids.workspaceB1, personaId: ids.personaB },
  ] });
  await prisma.workspaceQuestionnaire.createMany({ data: [
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA1, questionnaireId: ids.questionnaireA },
    { tenantId: ids.tenantA, workspaceId: ids.workspaceA2, questionnaireId: ids.questionnaireA },
    { tenantId: ids.tenantB, workspaceId: ids.workspaceB1, questionnaireId: ids.questionnaireB },
  ] });

  await prisma.projectPersonaUsage.create({ data: {
    tenantId: ids.tenantA, workspaceId: ids.workspaceA1, projectId: ids.projectA1,
    personaId: ids.personaA, version: 1,
    snapshot: { id: ids.personaA, name: 'QA Persona A', description: 'QA_PERSONA_A_SENTINEL', data: { profile: 'tenant-a-v1' }, version: 1 },
  } });
  await prisma.projectQuestionnaireUsage.create({ data: {
    tenantId: ids.tenantA, workspaceId: ids.workspaceA1, projectId: ids.projectA1,
    questionnaireId: ids.questionnaireA, version: 1,
    snapshot: { id: ids.questionnaireA, name: 'QA Questionnaire A', description: 'QA_QUESTIONNAIRE_A_SENTINEL', data: { questions: ['A?'] }, version: 1 },
  } });

  const examplePath = resolve('qa/spec-blackbox.config.example.json');
  const outputPath = resolve(process.env.QA_FIXTURE_CONFIG ?? 'qa/.tmp/spec-blackbox.config.json');
  const config = JSON.parse(await readFile(examplePath, 'utf8'));
  config.baseUrl = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3101/api/v1';
  config.origin = process.env.QA_ORIGIN ?? 'http://localhost:5173';
  for (const [key, account] of Object.entries(config.credentials)) {
    account.password = PASSWORD;
    if (accounts[key]) account.email = accounts[key][0];
  }
  config.credentials.existingIdentityNotInB.wrongPassword = WRONG_PASSWORD;
  config.credentials.suspendedIdentity.id = userIds.suspendedIdentity;
  config.credentials.suspendedMembershipIdentity.id = userIds.suspendedMembershipIdentity;
  config.credentials.crossTenantGrantMember.id = userIds.crossTenantGrantMember;
  config.sentinels.personaA = 'QA_PERSONA_A_SENTINEL';
  config.sentinels.questionnaireA = 'QA_QUESTIONNAIRE_A_SENTINEL';
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`Fixture criada em ${databaseName}; configuração: ${outputPath}\n`);
} finally {
  await prisma.$disconnect();
}
