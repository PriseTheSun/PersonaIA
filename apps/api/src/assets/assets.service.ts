import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssetType, AssociationAction, ClientRole, Feature, MembershipStatus,
  PermissionLevel, Prisma, RecordStatus,
} from '@prisma/client';
import { AccessControlService } from '../common/access-control.service';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { AssetQuery, CreateAssetInput, QuestionnaireQuestionInput, UpdateAssetInput } from './assets.schemas';

type Kind = 'PERSONA' | 'QUESTIONNAIRE';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService) {}

  async list(kind: Kind, tenantId: string, query: AssetQuery, actor: Principal) {
    await this.access.requireTenant(actor, tenantId);
    const admin = this.access.isSuper(actor) || await this.isClientAdmin(actor.id, tenantId);
    let workspaceIds: string[] | undefined;
    if (query.workspaceId) {
      const workspace = await this.access.requireFeature(actor, {
        workspaceId: query.workspaceId, feature: this.feature(kind), level: PermissionLevel.READ,
      });
      if (workspace.tenantId !== tenantId) throw new NotFoundException('Workspace não encontrado.');
      workspaceIds = [query.workspaceId];
    } else if (!admin) {
      const memberships = await this.prisma.workspaceMembership.findMany({
        where: {
          tenantId, userId: actor.id, status: MembershipStatus.ACTIVE,
          workspace: { status: RecordStatus.ACTIVE }, clientMembership: { status: MembershipStatus.ACTIVE },
        },
        select: { workspaceId: true },
      });
      workspaceIds = [];
      for (const { workspaceId } of memberships) {
        try {
          await this.access.requireFeature(actor, { workspaceId, feature: this.feature(kind), level: PermissionLevel.READ });
          workspaceIds.push(workspaceId);
        } catch { /* Explicit deny or no READ: omit this workspace. */ }
      }
    }
    if (kind === 'PERSONA') {
      const [items, usage] = await Promise.all([this.prisma.persona.findMany({
        where: {
          tenantId, status: { not: RecordStatus.REMOVED },
          ...(workspaceIds ? { workspaces: { some: { workspaceId: { in: workspaceIds }, disassociatedAt: null } } } : {}),
        },
        include: {
          workspaces: {
            where: { disassociatedAt: null, ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}) },
            select: { workspaceId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }), this.prisma.projectPersonaUsage.groupBy({
        by: ['personaId'], where: {
          tenantId, project: { status: RecordStatus.ACTIVE },
          ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}),
        }, _count: true,
      })]);
      const usageCounts = new Map(usage.map((item) => [item.personaId, item._count]));
      return items.map(({ workspaces, ...item }) => ({
        ...item, workspaceIds: workspaces.map(({ workspaceId }) => workspaceId), activeProjectUsageCount: usageCounts.get(item.id) ?? 0,
      }));
    }
    const [items, usage] = await Promise.all([this.prisma.questionnaire.findMany({
      where: {
        tenantId, status: { not: RecordStatus.REMOVED },
        ...(workspaceIds ? { workspaces: { some: { workspaceId: { in: workspaceIds }, disassociatedAt: null } } } : {}),
      },
      include: {
        workspaces: {
          where: { disassociatedAt: null, ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}) },
          select: { workspaceId: true },
        },
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: 'desc' },
    }), this.prisma.projectQuestionnaireUsage.groupBy({
      by: ['questionnaireId'], where: {
        tenantId, project: { status: RecordStatus.ACTIVE },
        ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}),
      }, _count: true,
    })]);
    const usageCounts = new Map(usage.map((item) => [item.questionnaireId, item._count]));
    return items.map(({ workspaces, _count, ...item }) => ({
      ...item, workspaceIds: workspaces.map(({ workspaceId }) => workspaceId), questionCount: _count.questions,
      activeProjectUsageCount: usageCounts.get(item.id) ?? 0,
    }));
  }

  async get(kind: Kind, tenantId: string, assetId: string, actor: Principal) {
    const items = await this.list(kind, tenantId, {}, actor);
    const asset = items.find(({ id }) => id === assetId);
    if (!asset) throw new NotFoundException('Ativo não encontrado.');
    return asset;
  }

  async create(kind: Kind, tenantId: string, input: CreateAssetInput, actor: Principal) {
    await this.access.requireTenant(actor, tenantId);
    const admin = this.access.isSuper(actor) || await this.isClientAdmin(actor.id, tenantId);
    const workspaceIds = [...new Set(input.workspaceIds)];
    if (!admin && workspaceIds.length === 0) throw new BadRequestException('Informe um workspace para validar a permissão funcional.');
    if (!admin && workspaceIds.length > 1) throw new BadRequestException('Membros podem criar o ativo em um workspace por vez.');
    const feature = this.feature(kind);
    for (const workspaceId of workspaceIds) {
      const workspace = await this.access.requireFeature(actor, { workspaceId, feature, level: PermissionLevel.WRITE });
      if (workspace.tenantId !== tenantId) throw new NotFoundException('Workspace não encontrado.');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      const activeTenant = await tx.tenant.count({ where: { id: tenantId, status: RecordStatus.ACTIVE } });
      if (!activeTenant) throw new NotFoundException('Organização não encontrada.');
      const asset = kind === 'PERSONA'
        ? await tx.persona.create({ data: { tenantId, name: input.name.trim(), description: input.description?.trim(), data: input.data as Prisma.InputJsonValue } })
        : await tx.questionnaire.create({ data: { tenantId, name: input.name.trim(), description: input.description?.trim(), data: input.data as Prisma.InputJsonValue } });
      // Creation in a workspace establishes its initial reference. Additional
      // associations remain restricted to scoped/global administrators.
      const associatedWorkspaceIds: string[] = [];
      for (const workspaceId of workspaceIds) {
        await this.associateTx(tx, kind, tenantId, asset.id, workspaceId, actor.id);
        associatedWorkspaceIds.push(workspaceId);
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: kind === 'PERSONA' ? 'PERSONA_CREATED' : 'QUESTIONNAIRE_CREATED',
          targetType: kind === 'PERSONA' ? 'Persona' : 'Questionnaire', targetId: asset.id,
          scopeType: 'TENANT', scopeId: tenantId, metadata: { requestedWorkspaceIds: workspaceIds },
        },
      });
      return { ...asset, workspaceIds: associatedWorkspaceIds };
    });
  }

  async update(kind: Kind, tenantId: string, assetId: string, input: UpdateAssetInput, actor: Principal) {
    await this.requireAssetWrite(kind, tenantId, assetId, actor);
    return this.prisma.$transaction(async (tx) => {
      const data = {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() ?? null } : {}),
        ...(input.data ? { data: input.data as Prisma.InputJsonValue } : {}),
        version: { increment: 1 },
      };
      const asset = kind === 'PERSONA'
        ? await tx.persona.update({ where: { id: assetId }, data })
        : await tx.questionnaire.update({ where: { id: assetId }, data });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: kind === 'PERSONA' ? 'PERSONA_UPDATED' : 'QUESTIONNAIRE_UPDATED',
          targetType: kind === 'PERSONA' ? 'Persona' : 'Questionnaire', targetId: assetId,
          scopeType: 'TENANT', scopeId: tenantId, metadata: { changed: Object.keys(input), version: asset.version },
        },
      });
      return asset;
    });
  }

  async listQuestions(tenantId: string, questionnaireId: string, actor: Principal) {
    await this.get('QUESTIONNAIRE', tenantId, questionnaireId, actor);
    return this.prisma.questionnaireQuestion.findMany({
      where: { tenantId, questionnaireId },
      include: { options: { orderBy: { position: 'asc' } } },
      orderBy: { position: 'asc' },
    });
  }

  async createQuestion(tenantId: string, questionnaireId: string, input: QuestionnaireQuestionInput, actor: Principal) {
    await this.requireAssetWrite('QUESTIONNAIRE', tenantId, questionnaireId, actor);
    return this.prisma.$transaction(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      await this.requireAssetTx(tx, 'QUESTIONNAIRE', tenantId, questionnaireId);
      const aggregate = await tx.questionnaireQuestion.aggregate({ where: { tenantId, questionnaireId }, _max: { position: true } });
      const question = await tx.questionnaireQuestion.create({
        data: {
          tenantId,
          questionnaireId,
          prompt: input.prompt,
          type: input.type,
          position: (aggregate._max.position ?? -1) + 1,
          ...(input.type === 'MULTIPLE_CHOICE' ? {
            options: { create: input.options.map((label, position) => ({ tenantId, label, position })) },
          } : {}),
        },
        include: { options: { orderBy: { position: 'asc' } } },
      });
      await tx.questionnaire.update({ where: { id: questionnaireId }, data: { version: { increment: 1 } } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: 'QUESTIONNAIRE_QUESTION_CREATED', targetType: 'QuestionnaireQuestion', targetId: question.id,
          scopeType: 'TENANT', scopeId: tenantId, metadata: { questionnaireId, type: input.type, position: question.position },
        },
      });
      return question;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateQuestion(tenantId: string, questionnaireId: string, questionId: string, input: QuestionnaireQuestionInput, actor: Principal) {
    await this.requireAssetWrite('QUESTIONNAIRE', tenantId, questionnaireId, actor);
    return this.prisma.$transaction(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      await this.requireAssetTx(tx, 'QUESTIONNAIRE', tenantId, questionnaireId);
      const existing = await tx.questionnaireQuestion.findFirst({ where: { id: questionId, tenantId, questionnaireId } });
      if (!existing) throw new NotFoundException('Pergunta não encontrada.');
      await tx.questionnaireOption.deleteMany({ where: { tenantId, questionId } });
      await tx.questionnaireQuestion.update({
        where: { id: questionId },
        data: { prompt: input.prompt, type: input.type },
      });
      if (input.type === 'MULTIPLE_CHOICE') {
        await tx.questionnaireOption.createMany({
          data: input.options.map((label, position) => ({ tenantId, questionId, label, position })),
        });
      }
      await tx.questionnaire.update({ where: { id: questionnaireId }, data: { version: { increment: 1 } } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: 'QUESTIONNAIRE_QUESTION_UPDATED', targetType: 'QuestionnaireQuestion', targetId: questionId,
          scopeType: 'TENANT', scopeId: tenantId, metadata: { questionnaireId, previousType: existing.type, type: input.type },
        },
      });
      return tx.questionnaireQuestion.findUniqueOrThrow({
        where: { id: questionId },
        include: { options: { orderBy: { position: 'asc' } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async removeQuestion(tenantId: string, questionnaireId: string, questionId: string, actor: Principal) {
    await this.requireAssetWrite('QUESTIONNAIRE', tenantId, questionnaireId, actor);
    await this.prisma.$transaction(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      await this.requireAssetTx(tx, 'QUESTIONNAIRE', tenantId, questionnaireId);
      const question = await tx.questionnaireQuestion.findFirst({ where: { id: questionId, tenantId, questionnaireId } });
      if (!question) throw new NotFoundException('Pergunta não encontrada.');
      await tx.questionnaireQuestion.delete({ where: { id: questionId } });
      await tx.questionnaire.update({ where: { id: questionnaireId }, data: { version: { increment: 1 } } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: 'QUESTIONNAIRE_QUESTION_REMOVED', targetType: 'QuestionnaireQuestion', targetId: questionId,
          scopeType: 'TENANT', scopeId: tenantId, metadata: { questionnaireId, type: question.type, position: question.position },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { success: true };
  }

  async remove(kind: Kind, tenantId: string, assetId: string, actor: Principal) {
    await this.access.requireTenant(actor, tenantId, true);
    await this.requireAsset(kind, tenantId, assetId);
    await this.prisma.$transaction(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      const activeUsage = kind === 'PERSONA'
        ? await tx.projectPersonaUsage.count({ where: { tenantId, personaId: assetId, project: { status: RecordStatus.ACTIVE } } })
        : await tx.projectQuestionnaireUsage.count({ where: { tenantId, questionnaireId: assetId, project: { status: RecordStatus.ACTIVE } } });
      if (activeUsage > 0) throw new ConflictException('O ativo está em uso por projeto ativo e não pode ser excluído.');
      const associations = kind === 'PERSONA'
        ? await tx.workspacePersona.findMany({ where: { tenantId, personaId: assetId, disassociatedAt: null } })
        : await tx.workspaceQuestionnaire.findMany({ where: { tenantId, questionnaireId: assetId, disassociatedAt: null } });
      const now = new Date();
      if (kind === 'PERSONA') {
        await tx.workspacePersona.updateMany({ where: { tenantId, personaId: assetId, disassociatedAt: null }, data: { disassociatedAt: now } });
        await tx.persona.update({ where: { id: assetId }, data: { status: RecordStatus.REMOVED } });
      } else {
        await tx.workspaceQuestionnaire.updateMany({ where: { tenantId, questionnaireId: assetId, disassociatedAt: null }, data: { disassociatedAt: now } });
        await tx.questionnaire.update({ where: { id: assetId }, data: { status: RecordStatus.REMOVED } });
      }
      if (associations.length) {
        await tx.assetAssociationHistory.createMany({
          data: associations.map(({ workspaceId }) => ({
            tenantId, workspaceId, assetType: kind as AssetType, assetId,
            action: AssociationAction.DISASSOCIATED, actorId: actor.id,
            metadata: { reason: 'ASSET_REMOVED' },
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: kind === 'PERSONA' ? 'PERSONA_REMOVED' : 'QUESTIONNAIRE_REMOVED',
          targetType: kind === 'PERSONA' ? 'Persona' : 'Questionnaire', targetId: assetId,
          scopeType: 'TENANT', scopeId: tenantId, metadata: { disassociatedWorkspaceIds: associations.map(({ workspaceId }) => workspaceId) },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { success: true };
  }

  async associate(kind: Kind, tenantId: string, assetId: string, workspaceId: string, actor: Principal) {
    const workspace = await this.access.requireWorkspace(actor, workspaceId, true);
    if (workspace.tenantId !== tenantId) throw new NotFoundException('Workspace não encontrado.');
    await this.requireAsset(kind, tenantId, assetId);
    await this.prisma.$transaction(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      await this.requireAssociationAdminTx(tx, actor, tenantId, workspaceId);
      await this.requireAssetTx(tx, kind, tenantId, assetId);
      await this.associateTx(tx, kind, tenantId, assetId, workspaceId, actor.id);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { associated: true, assetId, workspaceId };
  }

  async disassociate(kind: Kind, tenantId: string, assetId: string, workspaceId: string, actor: Principal) {
    const workspace = await this.access.requireWorkspace(actor, workspaceId, true);
    if (workspace.tenantId !== tenantId) throw new NotFoundException('Workspace não encontrado.');
    await this.requireAsset(kind, tenantId, assetId);
    await this.prisma.$transaction(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      await this.requireAssociationAdminTx(tx, actor, tenantId, workspaceId);
      await this.requireAssetTx(tx, kind, tenantId, assetId);
      const now = new Date();
      const updated = kind === 'PERSONA'
        ? await tx.workspacePersona.updateMany({ where: { tenantId, workspaceId, personaId: assetId, disassociatedAt: null }, data: { disassociatedAt: now } })
        : await tx.workspaceQuestionnaire.updateMany({ where: { tenantId, workspaceId, questionnaireId: assetId, disassociatedAt: null }, data: { disassociatedAt: now } });
      if (updated.count !== 1) throw new NotFoundException('Associação não encontrada.');
      await tx.assetAssociationHistory.create({
        data: { tenantId, workspaceId, assetType: kind as AssetType, assetId, action: AssociationAction.DISASSOCIATED, actorId: actor.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: `${kind}_DISASSOCIATED`, targetType: kind, targetId: assetId,
          scopeType: 'WORKSPACE', scopeId: workspaceId,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { associated: false, assetId, workspaceId };
  }

  async replaceAssociations(kind: Kind, tenantId: string, assetId: string, requestedIds: string[], actor: Principal) {
    await this.access.requireTenant(actor, tenantId);
    await this.requireAsset(kind, tenantId, assetId);
    return this.prisma.$transaction(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      await this.requireAssetTx(tx, kind, tenantId, assetId);
      const validRequested = await tx.workspace.count({
        where: { id: { in: requestedIds }, tenantId, status: RecordStatus.ACTIVE },
      });
      if (validRequested !== requestedIds.length) throw new NotFoundException('Um ou mais workspaces não foram encontrados.');
      const liveIds = kind === 'PERSONA'
        ? (await tx.workspacePersona.findMany({ where: { tenantId, personaId: assetId, disassociatedAt: null }, select: { workspaceId: true } })).map(({ workspaceId }) => workspaceId)
        : (await tx.workspaceQuestionnaire.findMany({ where: { tenantId, questionnaireId: assetId, disassociatedAt: null }, select: { workspaceId: true } })).map(({ workspaceId }) => workspaceId);
      const tenantAdmin = this.access.isSuper(actor) || (await tx.clientMembership.count({
        where: { tenantId, userId: actor.id, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
      })) > 0;
      if (!tenantAdmin) throw new ForbiddenException('A substituição em lote exige um administrador da organização; use a associação por workspace.');
      const manageable = new Set<string>();
      for (const workspaceId of [...new Set([...liveIds, ...requestedIds])]) manageable.add(workspaceId);
      const preservedIds = liveIds.filter((workspaceId) => !manageable.has(workspaceId));
      const desiredIds = [...new Set([...preservedIds, ...requestedIds])];
      const toAdd = desiredIds.filter((workspaceId) => !liveIds.includes(workspaceId));
      const toRemove = liveIds.filter((workspaceId) => manageable.has(workspaceId) && !desiredIds.includes(workspaceId));
      for (const workspaceId of toAdd) await this.associateTx(tx, kind, tenantId, assetId, workspaceId, actor.id);
      if (toRemove.length) {
        const now = new Date();
        if (kind === 'PERSONA') {
          await tx.workspacePersona.updateMany({ where: { tenantId, personaId: assetId, workspaceId: { in: toRemove }, disassociatedAt: null }, data: { disassociatedAt: now } });
        } else {
          await tx.workspaceQuestionnaire.updateMany({ where: { tenantId, questionnaireId: assetId, workspaceId: { in: toRemove }, disassociatedAt: null }, data: { disassociatedAt: now } });
        }
        await tx.assetAssociationHistory.createMany({
          data: toRemove.map((workspaceId) => ({
            tenantId, workspaceId, assetType: kind as AssetType, assetId,
            action: AssociationAction.DISASSOCIATED, actorId: actor.id, metadata: { source: 'BULK_REPLACE' },
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: `${kind}_WORKSPACES_REPLACED`, targetType: kind, targetId: assetId,
          scopeType: 'TENANT', scopeId: tenantId, metadata: { added: toAdd, removed: toRemove, preserved: preservedIds },
        },
      });
      return { assetId, workspaceIds: desiredIds, added: toAdd, removed: toRemove };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async recordUsage(rawType: string, projectId: string, assetId: string, actor: Principal) {
    const kind = this.parseKind(rawType);
    const project = await this.access.requireProject(actor, projectId);
    await this.access.requireFeature(actor, {
      workspaceId: project.workspaceId, projectId, feature: this.feature(kind), level: PermissionLevel.WRITE,
    });
    return this.prisma.$transaction(async (tx) => {
      await this.access.lockTenant(tx, project.tenantId);
      const currentProject = await tx.project.findFirst({
        where: { id: projectId, tenantId: project.tenantId, status: RecordStatus.ACTIVE },
      });
      if (!currentProject) throw new NotFoundException('Projeto não encontrado.');
      const persona = kind === 'PERSONA'
        ? await tx.persona.findFirst({ where: { id: assetId, tenantId: project.tenantId, status: RecordStatus.ACTIVE } })
        : null;
      const questionnaire = kind === 'QUESTIONNAIRE'
        ? await tx.questionnaire.findFirst({
          where: { id: assetId, tenantId: project.tenantId, status: RecordStatus.ACTIVE },
          include: { questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } } },
        })
        : null;
      const asset = persona ?? questionnaire;
      if (!asset) throw new NotFoundException('Ativo não encontrado.');
      if (currentProject.workspaceId) {
        const associated = kind === 'PERSONA'
          ? await tx.workspacePersona.count({ where: { workspaceId: currentProject.workspaceId, personaId: assetId, disassociatedAt: null } })
          : await tx.workspaceQuestionnaire.count({ where: { workspaceId: currentProject.workspaceId, questionnaireId: assetId, disassociatedAt: null } });
        if (!associated) throw new ConflictException('O ativo não está associado ao workspace do projeto.');
      }
      const snapshot = {
        id: asset.id, name: asset.name, description: asset.description, data: asset.data, version: asset.version,
        ...(questionnaire ? {
          questions: questionnaire.questions.map((question) => ({
            id: question.id, prompt: question.prompt, type: question.type, position: question.position,
            options: question.options.map((option) => ({ id: option.id, label: option.label, position: option.position })),
          })),
        } : {}),
      } as Prisma.InputJsonValue;
      const usage = kind === 'PERSONA'
        ? await tx.projectPersonaUsage.create({ data: { tenantId: project.tenantId, workspaceId: currentProject.workspaceId, projectId, personaId: assetId, version: asset.version, snapshot } })
        : await tx.projectQuestionnaireUsage.create({ data: { tenantId: project.tenantId, workspaceId: currentProject.workspaceId, projectId, questionnaireId: assetId, version: asset.version, snapshot } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId: project.tenantId, action: `${kind}_USED`, targetType: kind, targetId: assetId,
          scopeType: 'PROJECT', scopeId: projectId, metadata: { usageId: usage.id, version: asset.version },
        },
      });
      return usage;
    });
  }

  async listUsage(projectId: string, actor: Principal) {
    const project = await this.access.requireProject(actor, projectId);
    let personaRead = true;
    let questionnaireRead = true;
    try {
      await this.access.requireFeature(actor, { workspaceId: project.workspaceId, projectId, feature: Feature.PERSONA, level: PermissionLevel.READ });
    } catch { personaRead = false; }
    try {
      await this.access.requireFeature(actor, { workspaceId: project.workspaceId, projectId, feature: Feature.RESEARCH, level: PermissionLevel.READ });
    } catch { questionnaireRead = false; }
    if (!personaRead && !questionnaireRead) {
      await this.access.requireFeature(actor, { workspaceId: project.workspaceId, projectId, feature: Feature.PERSONA, level: PermissionLevel.READ });
    }
    const [personas, questionnaires] = await Promise.all([
      personaRead ? this.prisma.projectPersonaUsage.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }) : [],
      questionnaireRead ? this.prisma.projectQuestionnaireUsage.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }) : [],
    ]);
    return {
      personas: personas.map((item) => ({ ...item, assetType: 'PERSONA' as const, sourceAssetId: item.personaId })),
      questionnaires: questionnaires.map((item) => ({ ...item, assetType: 'QUESTIONNAIRE' as const, sourceAssetId: item.questionnaireId })),
    };
  }

  private async associateTx(tx: Prisma.TransactionClient, kind: Kind, tenantId: string, assetId: string, workspaceId: string, actorId: string) {
    const alreadyAssociated = kind === 'PERSONA'
      ? await tx.workspacePersona.count({ where: { tenantId, workspaceId, personaId: assetId, disassociatedAt: null } })
      : await tx.workspaceQuestionnaire.count({ where: { tenantId, workspaceId, questionnaireId: assetId, disassociatedAt: null } });
    if (alreadyAssociated) return;
    if (kind === 'PERSONA') {
      await tx.workspacePersona.upsert({
        where: { workspaceId_personaId: { workspaceId, personaId: assetId } },
        update: { associatedAt: new Date(), disassociatedAt: null },
        create: { tenantId, workspaceId, personaId: assetId },
      });
    } else {
      await tx.workspaceQuestionnaire.upsert({
        where: { workspaceId_questionnaireId: { workspaceId, questionnaireId: assetId } },
        update: { associatedAt: new Date(), disassociatedAt: null },
        create: { tenantId, workspaceId, questionnaireId: assetId },
      });
    }
    await tx.assetAssociationHistory.create({
      data: { tenantId, workspaceId, assetType: kind as AssetType, assetId, action: AssociationAction.ASSOCIATED, actorId },
    });
    await tx.auditLog.create({
      data: {
        actorId, tenantId, action: `${kind}_ASSOCIATED`, targetType: kind, targetId: assetId,
        scopeType: 'WORKSPACE', scopeId: workspaceId,
      },
    });
  }

  private async requireAssetTx(tx: Prisma.TransactionClient, kind: Kind, tenantId: string, assetId: string) {
    const asset = kind === 'PERSONA'
      ? await tx.persona.findFirst({ where: { id: assetId, tenantId, status: RecordStatus.ACTIVE } })
      : await tx.questionnaire.findFirst({ where: { id: assetId, tenantId, status: RecordStatus.ACTIVE } });
    if (!asset) throw new NotFoundException('Ativo não encontrado.');
    return asset;
  }

  private async requireAssociationAdminTx(tx: Prisma.TransactionClient, actor: Principal, tenantId: string, workspaceId: string) {
    const workspace = await tx.workspace.findFirst({ where: { id: workspaceId, tenantId, status: RecordStatus.ACTIVE, tenant: { status: RecordStatus.ACTIVE } } });
    if (!workspace) throw new NotFoundException('Workspace não encontrado.');
    if (this.access.isSuper(actor)) return;
    const clientAdmin = await tx.clientMembership.count({
      where: { tenantId, userId: actor.id, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
    });
    if (clientAdmin) return;
    const workspaceAdmin = await tx.workspaceMembership.count({
      where: {
        tenantId, workspaceId, userId: actor.id, role: 'WORKSPACE_ADMIN', status: MembershipStatus.ACTIVE,
        clientMembership: { status: MembershipStatus.ACTIVE },
      },
    });
    if (!workspaceAdmin) throw new NotFoundException('Workspace não encontrado.');
  }

  private async requireAssetWrite(kind: Kind, tenantId: string, assetId: string, actor: Principal) {
    await this.requireAsset(kind, tenantId, assetId);
    await this.access.requireTenant(actor, tenantId);
    if (this.access.isSuper(actor) || await this.isClientAdmin(actor.id, tenantId)) return;
    const workspaceIds = kind === 'PERSONA'
      ? (await this.prisma.workspacePersona.findMany({ where: { tenantId, personaId: assetId, disassociatedAt: null }, select: { workspaceId: true } })).map(({ workspaceId }) => workspaceId)
      : (await this.prisma.workspaceQuestionnaire.findMany({ where: { tenantId, questionnaireId: assetId, disassociatedAt: null }, select: { workspaceId: true } })).map(({ workspaceId }) => workspaceId);
    for (const workspaceId of workspaceIds) {
      try {
        await this.access.requireFeature(actor, { workspaceId, feature: this.feature(kind), level: PermissionLevel.WRITE });
        return;
      } catch { /* Try another associated workspace without revealing it. */ }
    }
    throw new NotFoundException('Ativo não encontrado.');
  }

  private async requireAsset(kind: Kind, tenantId: string, assetId: string) {
    const asset = kind === 'PERSONA'
      ? await this.prisma.persona.findFirst({ where: { id: assetId, tenantId, status: { not: RecordStatus.REMOVED } } })
      : await this.prisma.questionnaire.findFirst({ where: { id: assetId, tenantId, status: { not: RecordStatus.REMOVED } } });
    if (!asset) throw new NotFoundException('Ativo não encontrado.');
    return asset;
  }

  private async isClientAdmin(userId: string, tenantId: string) {
    return (await this.prisma.clientMembership.count({
      where: { userId, tenantId, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
    })) > 0;
  }

  private feature(kind: Kind) { return kind === 'PERSONA' ? Feature.PERSONA : Feature.RESEARCH; }
  private parseKind(raw: string): Kind {
    if (raw === 'persona' || raw === 'personas' || raw === 'PERSONA') return 'PERSONA';
    if (raw === 'questionnaire' || raw === 'questionnaires' || raw === 'QUESTIONNAIRE') return 'QUESTIONNAIRE';
    throw new BadRequestException('Tipo de ativo inválido.');
  }
}
