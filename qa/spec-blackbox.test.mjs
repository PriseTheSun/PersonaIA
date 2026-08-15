import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const configPath = process.env.SPEC_QA_CONFIG;
const config = configPath
  ? JSON.parse(await readFile(configPath, 'utf8'))
  : {};
const baseUrl = String(process.env.BASE_URL ?? config.baseUrl ?? '').replace(/\/$/, '');
const allowedOrigin = String(process.env.QA_ORIGIN ?? config.origin ?? '');
const loginIntervalMs = Number(process.env.QA_LOGIN_INTERVAL_MS ?? config.loginIntervalMs ?? 12_500);
const allowMutation = process.env.RUN_MUTATING === '1';
const credentials = config.credentials ?? {};
const ids = config.ids ?? {};
const sentinels = config.sentinels ?? {};
const probes = config.probes ?? {};
const disposableAdminRace = config.disposableAdminRace ?? {};
const sessions = new Map();
let loginQueue = Promise.resolve();
let lastLoginAt = 0;

function requireConfig(t, ...keys) {
  const missing = keys.filter((key) => {
    if (key === 'baseUrl') return !baseUrl;
    const [group, name] = key.split('.');
    return config[group]?.[name] === undefined;
  });
  if (missing.length) {
    t.skip(`configuração ausente: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

function requireMutation(t) {
  if (!allowMutation) {
    t.skip('requer RUN_MUTATING=1 em ambiente descartável');
    return false;
  }
  return true;
}

function url(path) {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function request(method, path, { session, token, body } = {}) {
  const headers = { accept: 'application/json' };
  const accessToken = session?.accessToken ?? token;
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (session?.cookie) headers.cookie = session.cookie;
  if (session?.csrfToken) headers['x-csrf-token'] = session.csrfToken;
  if (session && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.origin = allowedOrigin;
  }
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(url(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, text, json, headers: response.headers };
}

async function login(name) {
  if (sessions.has(name)) return sessions.get(name);
  const account = credentials[name];
  if (!account) return undefined;
  const sessionPromise = authenticate(account, name);
  sessions.set(name, sessionPromise);
  try {
    const session = await sessionPromise;
    sessions.set(name, session);
    return session;
  } catch (error) {
    sessions.delete(name);
    throw error;
  }
}

async function authenticate(account, label = account.email) {
  const response = await loginRequest({
    body: { email: account.email, password: account.password, rememberMe: false }
  });
  assert.equal(response.status, 201, `${label} não autenticou (${response.status})`);
  assert.equal(typeof response.json?.accessToken, 'string', `${label} sem accessToken`);
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  const cookie = setCookies.map((value) => value.split(';', 1)[0]).join('; ');
  const csrfCookie = setCookies
    .map((value) => value.split(';', 1)[0])
    .find((value) => value.startsWith('XSRF-TOKEN='));
  const csrfToken = csrfCookie
    ? decodeURIComponent(csrfCookie.slice('XSRF-TOKEN='.length))
    : undefined;
  const session = { accessToken: response.json.accessToken, cookie, csrfToken };
  return session;
}

async function loginRequest({ body }) {
  const run = loginQueue.then(async () => {
    const remaining = Math.max(0, lastLoginAt + loginIntervalMs - Date.now());
    if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
    lastLoginAt = Date.now();
    return request('POST', '/auth/login', { body });
  });
  loginQueue = run.then(() => undefined, () => undefined);
  return run;
}

function assertDenied(response, label) {
  assert.ok(
    [401, 403, 404].includes(response.status),
    `${label}: esperado 401/403/404, recebido ${response.status}`
  );
  assert.doesNotMatch(response.text, /csrf|origem não permitida|origin not allowed/i, `${label}: bloqueado antes da regra`);
  assert.doesNotMatch(response.text, /Prisma|PostgreSQL|SELECT|INSERT|UPDATE|DELETE FROM|at .+\(.+\.ts:\d+/i);
}

function assertRejectedInput(response, label) {
  assert.ok(
    [400, 403, 404, 409, 422].includes(response.status),
    `${label}: esperado input rejeitado, recebido ${response.status}`
  );
  assert.doesNotMatch(response.text, /csrf|origem não permitida|origin not allowed/i, `${label}: bloqueado antes da regra`);
  assert.doesNotMatch(response.text, /Prisma|PostgreSQL|constraint|\.ts:\d+|node_modules/i);
}

function records(response) {
  if (Array.isArray(response.json)) return response.json;
  if (Array.isArray(response.json?.items)) return response.json.items;
  if (Array.isArray(response.json?.data)) return response.json.data;
  return [];
}

function renderProbe(probe) {
  return {
    ...probe,
    path: String(probe.path)
      .replaceAll('PROJECT_A1', ids.projectA1 ?? 'PROJECT_A1')
      .replaceAll('PROJECT_A2', ids.projectA2 ?? 'PROJECT_A2')
      .replaceAll('PERSONA_A', ids.personaA ?? 'PERSONA_A')
      .replaceAll('QUESTIONNAIRE_A', ids.questionnaireA ?? 'QUESTIONNAIRE_A')
  };
}

test('configuração: a suíte nunca executa mutações por padrão', () => {
  assert.equal(allowMutation, process.env.RUN_MUTATING === '1');
});

test('RN-04/CY: rota protegida rejeita usuário anônimo', async (t) => {
  if (!requireConfig(t, 'baseUrl')) return;
  const response = await request('GET', '/projects');
  assert.equal(response.status, 401);
});

test('CY-09: PENDING_APPROVAL não cria sessão', async (t) => {
  if (!requireConfig(t, 'baseUrl', 'credentials.pendingApproval')) return;
  const account = credentials.pendingApproval;
  const response = await loginRequest({
    body: { email: account.email, password: account.password, rememberMe: false }
  });
  assert.ok([401, 403].includes(response.status), `conta pendente autenticou (${response.status})`);
  assert.equal(response.json?.accessToken, undefined);
});

test('RN-03/CY-02: CLIENT_ADMIN A não lê workspace B por IDs no path', async (t) => {
  if (!requireConfig(t, 'baseUrl', 'credentials.clientAdminA', 'ids.tenantB', 'ids.workspaceB1')) return;
  const session = await login('clientAdminA');
  const response = await request(
    'GET',
    `/tenants/${ids.tenantB}/workspaces/${ids.workspaceB1}`,
    { session }
  );
  assertDenied(response, 'workspace cross-tenant');
  assert.doesNotMatch(response.text, new RegExp(sentinels.tenantB ?? 'QA_SENTINEL_TENANT_B', 'i'));
});

test('RN-03/CY-02: CLIENT_ADMIN A não lê projeto B', async (t) => {
  if (!requireConfig(t, 'baseUrl', 'credentials.clientAdminA', 'ids.projectB1')) return;
  const session = await login('clientAdminA');
  const response = await request('GET', `/projects/${ids.projectB1}`, { session });
  assertDenied(response, 'projeto cross-tenant');
  assert.doesNotMatch(response.text, new RegExp(sentinels.tenantB ?? 'QA_SENTINEL_TENANT_B', 'i'));
});

test('RN-10/CY-02: CLIENT_ADMIN A não lê persona ou questionário B', async (t) => {
  if (!requireConfig(
    t,
    'baseUrl',
    'credentials.clientAdminA',
    'ids.tenantB',
    'ids.personaB',
    'ids.questionnaireB'
  )) return;
  const session = await login('clientAdminA');
  const [persona, questionnaire] = await Promise.all([
    request('GET', `/tenants/${ids.tenantB}/personas/${ids.personaB}`, { session }),
    request('GET', `/tenants/${ids.tenantB}/questionnaires/${ids.questionnaireB}`, { session })
  ]);
  assertDenied(persona, 'persona cross-tenant');
  assertDenied(questionnaire, 'questionário cross-tenant');
});

test('CY-07: SUPER_ADMIN com tenant A no path não pode usar workspace B', async (t) => {
  if (!requireConfig(t, 'baseUrl', 'credentials.superAdmin', 'ids.tenantA', 'ids.workspaceB1')) return;
  const session = await login('superAdmin');
  const response = await request(
    'GET',
    `/tenants/${ids.tenantA}/workspaces/${ids.workspaceB1}`,
    { session }
  );
  assertDenied(response, 'escopo inconsistente do SUPER_ADMIN');
});

test('RN-10/CY-04: associação de persona A a workspace B é impossível', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.clientAdminA',
    'ids.tenantA',
    'ids.personaA',
    'ids.workspaceB1'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const session = await login('clientAdminA');
  assert.ok(session.csrfToken && session.cookie, 'login não forneceu cookies CSRF');
  const response = await request(
    'POST',
    `/tenants/${ids.tenantA}/personas/${ids.personaA}/workspaces/${ids.workspaceB1}`,
    { session, body: {} }
  );
  assertRejectedInput(response, 'associação cross-tenant');
});

test('RN-10/CY-04: associação de questionário A a workspace B é impossível', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.clientAdminA',
    'ids.tenantA',
    'ids.questionnaireA',
    'ids.workspaceB1'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const session = await login('clientAdminA');
  assert.ok(session.csrfToken && session.cookie, 'login não forneceu cookies CSRF');
  const response = await request(
    'POST',
    `/tenants/${ids.tenantA}/questionnaires/${ids.questionnaireA}/workspaces/${ids.workspaceB1}`,
    { session, body: {} }
  );
  assertRejectedInput(response, 'associação cross-tenant');
});

test('CY-05: mass assignment não troca tenant/role/status ao criar workspace', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.clientAdminA',
    'ids.tenantA',
    'ids.tenantB'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const session = await login('clientAdminA');
  assert.ok(session.csrfToken && session.cookie, 'login não forneceu cookies CSRF');
  const response = await request('POST', `/tenants/${ids.tenantA}/workspaces`, {
    session,
    body: {
      name: `QA mass assignment ${Date.now()}`,
      description: 'Esta requisição deve ser rejeitada integralmente.',
      tenantId: ids.tenantB,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      isSuperAdmin: true
    }
  });
  assert.equal(response.status, 400, `mass assignment aceito (${response.status})`);
});

test('RN-11/CY-05: projeto não aceita mudança de workspace', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.clientAdminA',
    'ids.projectA1',
    'ids.workspaceA2'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const session = await login('clientAdminA');
  assert.ok(session.csrfToken && session.cookie, 'login não forneceu cookies CSRF');
  const response = await request('PATCH', `/projects/${ids.projectA1}`, {
    session,
    body: { workspaceId: ids.workspaceA2 }
  });
  assert.equal(response.status, 400, `workspaceId foi aceito no PATCH (${response.status})`);
});

test('RN-05/CY-01: JWT perde acesso na requisição seguinte à revogação', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.clientAdminA',
    'credentials.revocableMemberA',
    'ids.tenantA',
    'ids.revocableMemberA'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const adminSession = await login('clientAdminA');
  const memberSession = await login('revocableMemberA');
  assert.ok(adminSession.csrfToken && adminSession.cookie, 'login do admin não forneceu cookies CSRF');
  const membershipPath = `/tenants/${ids.tenantA}/memberships/${ids.revocableMemberA}`;
  const before = await request('GET', `/tenants/${ids.tenantA}/workspaces`, { session: memberSession });
  assert.ok([200, 201].includes(before.status), `fixture revogável sem acesso inicial (${before.status})`);

  const revoke = await request('PATCH', membershipPath, {
    session: adminSession,
    body: { status: 'REMOVED' }
  });
  assert.ok([200, 204].includes(revoke.status), `revogação falhou (${revoke.status})`);

  try {
    const after = await request('GET', `/tenants/${ids.tenantA}/workspaces`, { session: memberSession });
    assertDenied(after, 'JWT após revogação');
  } finally {
    const restore = await request('PATCH', membershipPath, {
      session: adminSession,
      body: { status: 'ACTIVE' }
    });
    assert.ok([200, 204].includes(restore.status), `fixture não foi restaurada (${restore.status})`);
  }
});

test('RN-03/RN-05/CY-10: identidade multi-cliente mantém contextos independentes', async (t) => {
  if (!requireConfig(
    t,
    'baseUrl',
    'credentials.multiClientUser',
    'ids.tenantA',
    'ids.tenantB'
  )) return;
  const session = await login('multiClientUser');
  const [a, b] = await Promise.all([
    request('GET', `/tenants/${ids.tenantA}/workspaces`, { session }),
    request('GET', `/tenants/${ids.tenantB}/workspaces`, { session })
  ]);
  assert.equal(a.status, 200, `contexto A indisponível (${a.status})`);
  assert.equal(b.status, 200, `contexto B indisponível (${b.status})`);
  if (sentinels.tenantB) assert.doesNotMatch(a.text, new RegExp(sentinels.tenantB, 'i'));
  if (sentinels.tenantA) assert.doesNotMatch(b.text, new RegExp(sentinels.tenantA, 'i'));
});

test('CY-15: autocadastro de identidade existente exige senha correta sem enumerar conta', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.clientAdminB',
    'credentials.existingIdentityNotInB',
    'ids.tenantB',
    'tenantSlugs.tenantB'
  )) return;
  const account = credentials.existingIdentityNotInB;
  assert.ok(account.wrongPassword, 'fixture exige wrongPassword forte e diferente');
  assert.notEqual(account.password, account.wrongPassword, 'wrongPassword não pode ser a senha correta');
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const adminSession = await login('clientAdminB');
  assert.ok(adminSession.csrfToken && adminSession.cookie, 'login do admin sem cookies CSRF');
  const originalSession = await authenticate(account, 'identidade existente antes do teste');
  const me = await request('GET', '/auth/me', { session: originalSession });
  assert.equal(me.status, 200);
  assert.equal(typeof me.json?.id, 'string', 'identidade existente sem id');

  const before = await request('GET', `/tenants/${ids.tenantB}/memberships`, {
    session: adminSession
  });
  assert.equal(before.status, 200);
  assert.equal(
    records(before).some((membership) => membership.userId === me.json.id),
    false,
    'fixture inválida: identidade já está vinculada ao tenant B'
  );

  const publicPayload = {
    name: 'QA Existing Identity',
    email: account.email,
    tenantSlug: config.tenantSlugs.tenantB
  };
  const wrong = await request('POST', '/auth/register', {
    body: { ...publicPayload, password: account.wrongPassword }
  });
  assert.ok([200, 201, 202].includes(wrong.status), `resposta anti-enumeração inválida (${wrong.status})`);

  const stillAuthenticates = await authenticate(account, 'identidade após tentativa com senha errada');
  assert.ok(stillAuthenticates.accessToken, 'senha original foi alterada pela tentativa de cadastro');
  const wrongLogin = await loginRequest({
    body: { email: account.email, password: account.wrongPassword, rememberMe: false }
  });
  assert.ok([401, 403].includes(wrongLogin.status), 'senha errada passou a autenticar');

  const afterWrong = await request('GET', `/tenants/${ids.tenantB}/memberships`, {
    session: adminSession
  });
  assert.equal(afterWrong.status, 200);
  assert.equal(
    records(afterWrong).some((membership) => membership.userId === me.json.id),
    false,
    'senha errada criou membership em outro tenant'
  );

  const correct = await request('POST', '/auth/register', {
    body: { ...publicPayload, password: account.password }
  });
  assert.equal(correct.status, wrong.status, 'status público permite distinguir senha correta da errada');
  assert.deepEqual(correct.json, wrong.json, 'body público permite distinguir senha correta da errada');

  try {
    const afterCorrect = await request('GET', `/tenants/${ids.tenantB}/memberships`, {
      session: adminSession
    });
    assert.equal(afterCorrect.status, 200);
    const pending = records(afterCorrect).find((membership) => membership.userId === me.json.id);
    assert.ok(pending, 'senha correta não criou membership independente');
    assert.equal(pending.status, 'PENDING_APPROVAL');
  } finally {
    const cleanup = await request(
      'DELETE',
      `/tenants/${ids.tenantB}/memberships/${me.json.id}`,
      { session: adminSession }
    );
    assert.ok([200, 204].includes(cleanup.status), `membership de QA não foi removida (${cleanup.status})`);
  }
});

test('CY-16/RN-13: identidade global SUSPENDED não é reativada ao criar tenant', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.superAdmin',
    'credentials.suspendedIdentity'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const session = await login('superAdmin');
  assert.ok(session.csrfToken && session.cookie, 'login não forneceu cookies CSRF');
  const suspended = credentials.suspendedIdentity;
  const beforeUsers = await request('GET', '/user-access', { session });
  assert.equal(beforeUsers.status, 200);
  const before = records(beforeUsers).find(
    (user) => user.id === suspended.id || user.email === suspended.email
  );
  assert.ok(before, 'identidade suspensa não encontrada na fixture');
  assert.equal(before.status, 'SUSPENDED', 'fixture precisa começar suspensa');

  const marker = Date.now();
  const slug = `qa-suspended-admin-${marker}`;
  const create = await request('POST', '/tenants', {
    session,
    body: {
      name: `QA Suspended Admin ${marker}`,
      slug,
      segment: 'QA',
      description: 'Esta criação deve falhar atomicamente.',
      admin: {
        name: suspended.name,
        email: suspended.email,
        password: suspended.password
      },
      workspace: { name: 'Workspace principal' }
    }
  });
  assert.ok(
    [400, 403, 409, 422].includes(create.status),
    `tenant foi criado usando identidade suspensa (${create.status})`
  );

  const [afterTenants, afterUsers] = await Promise.all([
    request('GET', '/tenants', { session }),
    request('GET', '/user-access', { session })
  ]);
  assert.equal(afterTenants.status, 200);
  assert.equal(afterUsers.status, 200);
  assert.equal(
    records(afterTenants).some((tenant) => tenant.slug === slug),
    false,
    'falha deixou tenant parcial persistido'
  );
  const after = records(afterUsers).find(
    (user) => user.id === suspended.id || user.email === suspended.email
  );
  assert.ok(after, 'identidade suspensa desapareceu após a tentativa');
  assert.equal(after.status, 'SUSPENDED', 'identidade foi reativada implicitamente');
});

test('CA-02/CY-17: todos CLIENT_ADMIN veem novo workspace e administram implicitamente', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.clientAdminA',
    'credentials.clientAdminA2',
    'ids.tenantA'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const creator = await login('clientAdminA');
  const secondAdmin = await login('clientAdminA2');
  assert.ok(creator.csrfToken && creator.cookie, 'login do primeiro admin sem cookies CSRF');
  assert.ok(secondAdmin.csrfToken && secondAdmin.cookie, 'login do segundo admin sem cookies CSRF');

  const marker = Date.now();
  const created = await request('POST', `/tenants/${ids.tenantA}/workspaces`, {
    session: creator,
    body: {
      name: `QA workspace compartilhado ${marker}`,
      description: 'Criado para validar herança de CLIENT_ADMIN.'
    }
  });
  assert.equal(created.status, 201, `workspace não foi criado (${created.status})`);
  assert.equal(typeof created.json?.id, 'string', 'workspace criado sem id');

  try {
    const [creatorMe, secondMe] = await Promise.all([
      request('GET', '/auth/me', { session: creator }),
      request('GET', '/auth/me', { session: secondAdmin })
    ]);
    assert.equal(creatorMe.status, 200);
    assert.equal(secondMe.status, 200);
    for (const [label, me] of [['criador', creatorMe], ['segundo admin', secondMe]]) {
      const context = me.json?.contexts?.find((item) => item.tenantId === ids.tenantA);
      assert.ok(context, `${label} não recebeu contexto do tenant A`);
      const workspace = context.workspaces?.find((item) => item.workspaceId === created.json.id);
      assert.ok(workspace, `${label} não enxerga novo workspace via /auth/me`);
      assert.equal(workspace.role, 'WORKSPACE_ADMIN', `${label} não recebeu papel efetivo de admin`);
      assert.equal(workspace.status, 'ACTIVE');
    }

    const updateBySecond = await request(
      'PATCH',
      `/tenants/${ids.tenantA}/workspaces/${created.json.id}`,
      {
        session: secondAdmin,
        body: { description: 'Atualizado pelo segundo CLIENT_ADMIN sem relogin.' }
      }
    );
    assert.ok([200, 204].includes(updateBySecond.status), `admin implícito não pôde atuar (${updateBySecond.status})`);
  } finally {
    const cleanup = await request(
      'DELETE',
      `/tenants/${ids.tenantA}/workspaces/${created.json.id}`,
      { session: creator }
    );
    assert.ok([200, 204].includes(cleanup.status), `workspace de QA não foi removido (${cleanup.status})`);
  }
});

test('CY-18: notificações e aprovação da mesma identidade são isoladas por tenant', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.superAdmin',
    'credentials.clientAdminA',
    'credentials.clientAdminB',
    'ids.tenantA',
    'ids.tenantB',
    'tenantSlugs.tenantA',
    'tenantSlugs.tenantB'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const [superSession, adminA, adminB] = await Promise.all([
    login('superAdmin'), login('clientAdminA'), login('clientAdminB')
  ]);
  assert.ok(adminA.csrfToken && adminA.cookie, 'login do admin A sem cookies CSRF');
  assert.ok(adminB.csrfToken && adminB.cookie, 'login do admin B sem cookies CSRF');
  const marker = Date.now();
  const email = `qa-notification-${marker}@example.test`;
  const password = 'QA-Notification-Pass-9!';
  const payload = { name: 'QA Notification Identity', email, password };

  const [registerA, registerB] = await Promise.all([
    request('POST', '/auth/register', { body: { ...payload, tenantSlug: config.tenantSlugs.tenantA } }),
    request('POST', '/auth/register', { body: { ...payload, tenantSlug: config.tenantSlugs.tenantB } })
  ]);
  assert.ok([200, 201, 202].includes(registerA.status), `cadastro A falhou (${registerA.status})`);
  assert.equal(registerB.status, registerA.status, `cadastros públicos divergiram (${registerB.status})`);

  const [membersA, membersB] = await Promise.all([
    request('GET', `/tenants/${ids.tenantA}/memberships`, { session: adminA }),
    request('GET', `/tenants/${ids.tenantB}/memberships`, { session: adminB })
  ]);
  assert.equal(membersA.status, 200);
  assert.equal(membersB.status, 200);
  const membershipA = records(membersA).find((item) => item.user?.email === email);
  const membershipB = records(membersB).find((item) => item.user?.email === email);
  assert.ok(membershipA && membershipB, 'identidade não recebeu os dois vínculos pendentes');
  assert.equal(membershipA.userId, membershipB.userId, 'identidade foi duplicada entre tenants');
  assert.equal(membershipA.status, 'PENDING_APPROVAL');
  assert.equal(membershipB.status, 'PENDING_APPROVAL');

  const notificationsBefore = await request('GET', '/notifications', { session: superSession });
  assert.equal(notificationsBefore.status, 200);
  const targetNotifications = records(notificationsBefore).filter(
    (item) => item.type === 'ACCESS_REQUESTED' && item.targetId === membershipA.userId
  );
  assert.deepEqual(
    [...new Set(targetNotifications.map((item) => item.tenantId))].sort(),
    [ids.tenantA, ids.tenantB].sort(),
    'notificações da mesma identidade colidiram entre tenants'
  );
  assert.ok(targetNotifications.every((item) => item.resolvedAt === null));

  const approveA = await request(
    'PATCH',
    `/tenants/${ids.tenantA}/memberships/${membershipA.userId}`,
    { session: adminA, body: { status: 'ACTIVE' } }
  );
  assert.ok([200, 204].includes(approveA.status), `aprovação A falhou (${approveA.status})`);

  try {
    const [notificationsAfter, currentB] = await Promise.all([
      request('GET', '/notifications', { session: superSession }),
      request('GET', `/tenants/${ids.tenantB}/memberships`, { session: adminB })
    ]);
    assert.equal(notificationsAfter.status, 200, 'sessão do SUPER_ADMIN foi invalidada por mudança scoped');
    assert.equal(currentB.status, 200);
    const afterByTenant = new Map(
      records(notificationsAfter)
        .filter((item) => item.type === 'ACCESS_REQUESTED' && item.targetId === membershipA.userId)
        .map((item) => [item.tenantId, item])
    );
    assert.ok(afterByTenant.get(ids.tenantA)?.resolvedAt, 'notificação A não foi resolvida');
    assert.equal(afterByTenant.get(ids.tenantB)?.resolvedAt, null, 'aprovação A resolveu notificação B');
    const pendingB = records(currentB).find((item) => item.userId === membershipA.userId);
    assert.equal(pendingB?.status, 'PENDING_APPROVAL', 'aprovação A alterou membership B');
  } finally {
    const cleanup = await Promise.all([
      request('DELETE', `/tenants/${ids.tenantA}/memberships/${membershipA.userId}`, { session: adminA }),
      request('DELETE', `/tenants/${ids.tenantB}/memberships/${membershipA.userId}`, { session: adminB })
    ]);
    for (const response of cleanup) {
      assert.ok([200, 204].includes(response.status), `membership de QA não foi removida (${response.status})`);
    }
  }
});

test('CY-19: CLIENT_ADMIN não reativa identidade global SUSPENDED por membership', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.clientAdminA',
    'credentials.superAdmin',
    'credentials.suspendedMembershipIdentity',
    'ids.tenantA'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const [adminSession, superSession] = await Promise.all([
    login('clientAdminA'), login('superAdmin')
  ]);
  const suspended = credentials.suspendedMembershipIdentity;
  const create = await request('POST', `/tenants/${ids.tenantA}/memberships`, {
    session: adminSession,
    body: { userId: suspended.id, role: 'CLIENT_MEMBER', status: 'ACTIVE' }
  });
  assert.ok([400, 403, 409, 422].includes(create.status), `CLIENT_ADMIN reativou identidade (${create.status})`);

  const [users, memberships] = await Promise.all([
    request('GET', '/user-access', { session: superSession }),
    request('GET', `/tenants/${ids.tenantA}/memberships`, { session: adminSession })
  ]);
  assert.equal(users.status, 200);
  assert.equal(memberships.status, 200);
  const identity = records(users).find((item) => item.id === suspended.id || item.email === suspended.email);
  assert.equal(identity?.status, 'SUSPENDED', 'estado global foi reativado implicitamente');
  assert.equal(
    records(memberships).some((item) => item.userId === suspended.id && item.status === 'ACTIVE'),
    false,
    'membership ACTIVE persistiu para identidade suspensa'
  );
});

test('RN-05/CY-20: grant e revoke scoped têm efeito imediato sem invalidar JWT', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.clientAdminB',
    'credentials.crossTenantGrantMember',
    'ids.tenantB'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const adminSession = await login('clientAdminB');
  const memberSession = await login('crossTenantGrantMember');
  const member = credentials.crossTenantGrantMember;

  const grant = await request('POST', `/tenants/${ids.tenantB}/memberships`, {
    session: adminSession,
    body: { userId: member.id, role: 'CLIENT_MEMBER', status: 'ACTIVE' }
  });
  assert.ok([200, 201].includes(grant.status), `grant scoped falhou (${grant.status})`);

  try {
    const afterGrant = await request('GET', `/tenants/${ids.tenantB}/workspaces`, {
      session: memberSession
    });
    assert.equal(afterGrant.status, 200, `JWT foi invalidado ou grant não teve efeito (${afterGrant.status})`);

    const revoke = await request(
      'DELETE',
      `/tenants/${ids.tenantB}/memberships/${member.id}`,
      { session: adminSession }
    );
    assert.ok([200, 204].includes(revoke.status), `revoke scoped falhou (${revoke.status})`);

    const [afterRevoke, meAfterRevoke] = await Promise.all([
      request('GET', `/tenants/${ids.tenantB}/workspaces`, { session: memberSession }),
      request('GET', '/auth/me', { session: memberSession })
    ]);
    assert.ok([403, 404].includes(afterRevoke.status), `revoke não teve efeito (${afterRevoke.status})`);
    assert.equal(meAfterRevoke.status, 200, 'revoke scoped invalidou JWT/sessão global');
    assert.equal(
      meAfterRevoke.json?.contexts?.some((context) => context.tenantId === ids.tenantB),
      false,
      'contexto revogado permaneceu em /auth/me'
    );
  } finally {
    const current = await request('GET', `/tenants/${ids.tenantB}/memberships`, {
      session: adminSession
    });
    const active = records(current).some((item) => item.userId === member.id && item.status === 'ACTIVE');
    if (active) {
      await request('DELETE', `/tenants/${ids.tenantB}/memberships/${member.id}`, {
        session: adminSession
      });
    }
  }
});

test('RN-12/CY-06: DENY de projeto vence ADMIN herdado sem contaminar outro projeto', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.denyMemberA',
    'ids.projectA1',
    'ids.projectA2',
    'ids.personaA',
    'probes.denyPersona',
    'probes.inheritedPersona'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const session = await login('denyMemberA');
  assert.ok(session.csrfToken && session.cookie, 'login não forneceu cookies CSRF');
  const denyProbe = renderProbe(probes.denyPersona);
  const inheritedProbe = renderProbe(probes.inheritedPersona);

  const denied = await request(denyProbe.method, denyProbe.path, {
    session,
    body: denyProbe.body
  });
  assertDenied(denied, 'DENY explícito no projeto A1');

  const inherited = await request(inheritedProbe.method, inheritedProbe.path, {
    session,
    body: inheritedProbe.body
  });
  assert.ok(
    [200, 201, 204].includes(inherited.status),
    `ADMIN herdado não funcionou no projeto A2 (${inherited.status})`
  );
});

test('matriz literal/CY-12: PERSONA WRITE cria projeto sem ganhar administração', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.workspaceMemberA',
    'credentials.clientAdminA',
    'ids.workspaceA1',
    'ids.workspaceMemberA'
  )) return;
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const memberSession = await login('workspaceMemberA');
  const adminSession = await login('clientAdminA');
  assert.ok(memberSession.csrfToken && memberSession.cookie, 'login do membro sem cookies CSRF');
  assert.ok(adminSession.csrfToken && adminSession.cookie, 'login do admin sem cookies CSRF');

  const marker = Date.now();
  const created = await request('POST', '/projects', {
    session: memberSession,
    body: {
      workspaceId: ids.workspaceA1,
      name: `QA PERSONA WRITE ${marker}`,
      description: 'Projeto descartável criado pelo teste da matriz literal.'
    }
  });
  assert.equal(created.status, 201, `PERSONA WRITE não criou projeto (${created.status})`);
  assert.equal(typeof created.json?.id, 'string', 'projeto criado sem id');

  try {
    const edit = await request('PATCH', `/projects/${created.json.id}`, {
      session: memberSession,
      body: { name: `QA escalada ${marker}` }
    });
    assertDenied(edit, 'criador não administrativo tentou editar projeto');

    const configure = await request(
      'PUT',
      `/projects/${created.json.id}/members/${ids.workspaceMemberA}/permissions`,
      {
        session: memberSession,
        body: {
          permissions: [{ feature: 'PERSONA', level: 'ADMIN', effect: 'ALLOW' }]
        }
      }
    );
    assertDenied(configure, 'criador não administrativo tentou conceder ADMIN');
  } finally {
    const cleanup = await request('DELETE', `/projects/${created.json.id}`, {
      session: adminSession
    });
    assert.ok([200, 204].includes(cleanup.status), `projeto de QA não foi removido (${cleanup.status})`);
  }
});

test('RN-01/RN-13/CY-11: corrida não remove todos os CLIENT_ADMIN ativos', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.superAdmin',
    'disposableAdminRace.tenantId',
    'disposableAdminRace.clientAdminUserIds'
  )) return;
  assert.equal(disposableAdminRace.clientAdminUserIds.length, 2, 'fixture exige exatamente dois CLIENT_ADMIN');
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const session = await login('superAdmin');
  assert.ok(session.csrfToken && session.cookie, 'login não forneceu cookies CSRF');

  const results = await Promise.all(
    disposableAdminRace.clientAdminUserIds.map((userId) =>
      request('DELETE', `/tenants/${disposableAdminRace.tenantId}/memberships/${userId}`, { session })
    )
  );
  const successes = results.filter((response) => [200, 204].includes(response.status));
  const conflicts = results.filter((response) => [400, 409, 422].includes(response.status));
  assert.equal(successes.length, 1, `esperada uma remoção confirmada, obtidas ${successes.length}`);
  assert.equal(conflicts.length, 1, `esperado um bloqueio do último admin, obtidos ${conflicts.length}`);

  const current = await request(
    'GET',
    `/tenants/${disposableAdminRace.tenantId}/memberships`,
    { session }
  );
  assert.equal(current.status, 200);
  const activeAdmins = records(current).filter(
    (membership) => membership.role === 'CLIENT_ADMIN' && membership.status === 'ACTIVE'
  );
  assert.ok(activeAdmins.length >= 1, 'tenant ficou sem CLIENT_ADMIN ativo');
});

test('RN-02/RN-13/CY-11: corrida não remove todos os WORKSPACE_ADMIN ativos', async (t) => {
  if (!requireMutation(t) || !requireConfig(
    t,
    'baseUrl',
    'credentials.superAdmin',
    'disposableAdminRace.workspaceId',
    'disposableAdminRace.workspaceAdminUserIds'
  )) return;
  assert.equal(disposableAdminRace.workspaceAdminUserIds.length, 2, 'fixture exige exatamente dois WORKSPACE_ADMIN');
  if (!allowedOrigin) assert.fail('origin permitido não configurado');
  const session = await login('superAdmin');
  assert.ok(session.csrfToken && session.cookie, 'login não forneceu cookies CSRF');

  const results = await Promise.all(
    disposableAdminRace.workspaceAdminUserIds.map((userId) =>
      request('DELETE', `/workspaces/${disposableAdminRace.workspaceId}/members/${userId}`, { session })
    )
  );
  const successes = results.filter((response) => [200, 204].includes(response.status));
  const conflicts = results.filter((response) => [400, 409, 422].includes(response.status));
  assert.equal(successes.length, 1, `esperada uma remoção confirmada, obtidas ${successes.length}`);
  assert.equal(conflicts.length, 1, `esperado um bloqueio do último admin, obtidos ${conflicts.length}`);

  const current = await request(
    'GET',
    `/workspaces/${disposableAdminRace.workspaceId}/members`,
    { session }
  );
  assert.equal(current.status, 200);
  const activeAdmins = records(current).filter(
    (membership) => membership.role === 'WORKSPACE_ADMIN' && membership.status === 'ACTIVE'
  );
  assert.ok(activeAdmins.length >= 1, 'workspace ficou sem WORKSPACE_ADMIN ativo');
});

test('contrato de erro: nenhuma resposta testada expõe detalhes internos', async (t) => {
  if (!requireConfig(t, 'baseUrl')) return;
  const response = await request('GET', '/projects/not-a-uuid');
  assert.ok([400, 401].includes(response.status));
  assert.doesNotMatch(response.text, /Prisma|PostgreSQL|constraint|node_modules|\.ts:\d+/i);
});
