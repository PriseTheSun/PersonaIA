import { AssetsService } from './assets.service';

describe('AssetsService questionnaire questions', () => {
  const tenantId = '10000000-0000-4000-8000-000000000001';
  const workspaceId = '20000000-0000-4000-8000-000000000002';
  const questionnaireId = '30000000-0000-4000-8000-000000000003';
  const questionId = '40000000-0000-4000-8000-000000000004';
  const actor = {
    id: '50000000-0000-4000-8000-000000000005', tenantId: null, email: 'admin@personaia.test', name: 'Admin',
    role: 'SUPER_ADMIN' as const, tokenVersion: 0,
  };

  it('creates a questionnaire directly in the organization without a workspace', async () => {
    const clientAdmin = { ...actor, role: 'PROJECT_USER' as const };
    const questionnaire = {
      id: questionnaireId, tenantId, name: 'Pesquisa sem pasta', description: null, data: {}, version: 1,
    };
    const tx = {
      tenant: { count: jest.fn().mockResolvedValue(1) },
      questionnaire: { create: jest.fn().mockResolvedValue(questionnaire) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      clientMembership: { count: jest.fn().mockResolvedValue(1) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const access = {
      requireTenant: jest.fn().mockResolvedValue({ id: tenantId }),
      isSuper: jest.fn().mockReturnValue(false),
      lockTenant: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AssetsService(prisma as never, access as never);

    await expect(service.create('QUESTIONNAIRE', tenantId, {
      name: 'Pesquisa sem pasta', data: {}, workspaceIds: [],
    }, clientAdmin)).resolves.toEqual({ ...questionnaire, workspaceIds: [] });
    expect(tx.questionnaire.create).toHaveBeenCalledWith({
      data: { tenantId, name: 'Pesquisa sem pasta', description: undefined, data: {} },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'QUESTIONNAIRE_CREATED', metadata: { requestedWorkspaceIds: [] } }),
    }));
  });

  it('creates an ordered multiple-choice question inside the authorized organization', async () => {
    const created = {
      id: questionId, tenantId, questionnaireId, prompt: 'Qual canal?', type: 'MULTIPLE_CHOICE', position: 2,
      options: [{ id: 'option-1', label: 'Aplicativo', position: 0 }, { id: 'option-2', label: 'Site', position: 1 }],
    };
    const tx = {
      questionnaire: {
        findFirst: jest.fn().mockResolvedValue({ id: questionnaireId }),
        update: jest.fn().mockResolvedValue({}),
      },
      questionnaireQuestion: {
        aggregate: jest.fn().mockResolvedValue({ _max: { position: 1 } }),
        create: jest.fn().mockResolvedValue(created),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      questionnaire: { findFirst: jest.fn().mockResolvedValue({ id: questionnaireId }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const access = {
      requireTenant: jest.fn().mockResolvedValue({ id: tenantId }),
      isSuper: jest.fn().mockReturnValue(true),
      lockTenant: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AssetsService(prisma as never, access as never);

    await expect(service.createQuestion(tenantId, questionnaireId, {
      prompt: 'Qual canal?', type: 'MULTIPLE_CHOICE', options: ['Aplicativo', 'Site'],
    }, actor)).resolves.toEqual(created);
    expect(tx.questionnaireQuestion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId, questionnaireId, position: 2,
        options: { create: [{ label: 'Aplicativo', position: 0 }, { label: 'Site', position: 1 }] },
      }),
    }));
    expect(tx.questionnaire.update).toHaveBeenCalledWith(expect.objectContaining({ data: { version: { increment: 1 } } }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'QUESTIONNAIRE_QUESTION_CREATED' }) }));
  });

  it('stores the complete question structure in project usage snapshots', async () => {
    const questionnaire = {
      id: questionnaireId, name: 'Pesquisa', description: null, data: {}, version: 4,
      questions: [{
        id: questionId, prompt: 'Qual canal?', type: 'MULTIPLE_CHOICE', position: 0,
        options: [{ id: 'option-1', label: 'Aplicativo', position: 0 }, { id: 'option-2', label: 'Site', position: 1 }],
      }],
    };
    const tx = {
      project: { findFirst: jest.fn().mockResolvedValue({ id: 'project-1' }) },
      questionnaire: { findFirst: jest.fn().mockResolvedValue(questionnaire) },
      workspaceQuestionnaire: { count: jest.fn().mockResolvedValue(1) },
      projectQuestionnaireUsage: { create: jest.fn().mockResolvedValue({ id: 'usage-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
    const access = {
      requireProject: jest.fn().mockResolvedValue({ id: 'project-1', tenantId, workspaceId }),
      requireFeature: jest.fn().mockResolvedValue({ tenantId, workspaceId }),
      lockTenant: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AssetsService(prisma as never, access as never);

    await service.recordUsage('questionnaire', 'project-1', questionnaireId, actor);
    expect(tx.projectQuestionnaireUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questionnaireId,
        version: 4,
        snapshot: expect.objectContaining({
          questions: [expect.objectContaining({
            id: questionId,
            type: 'MULTIPLE_CHOICE',
            options: [
              { id: 'option-1', label: 'Aplicativo', position: 0 },
              { id: 'option-2', label: 'Site', position: 1 },
            ],
          })],
        }),
      }),
    });
  });
});
