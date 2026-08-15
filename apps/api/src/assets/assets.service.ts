import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssetType, AssociationAction, ClientRole, Feature, MembershipStatus,
  PermissionLevel, Prisma, RecordStatus,
} from '@prisma/client';
import { AccessControlService } from '../common/access-control.service';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { AssetQuery, CreateAssetInput, UpdateAssetInput } from './assets.schemas';

type Kind = 'PERSONA' | 'QUESTIONNAIRE';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService) {}

  async list(kind: Kind, tenantId: string, query: AssetQuery, actor: Principal) {
    await this.access.requireTenant(actor, tenantId);
    const admin = this.access.isSuper(actor) || await this.isClientAdmin(actor.id, tenantId);
    let workspaceIds: string[] | undefined;
    if (query.workspaceId) {
      const workspace = await this.access.requireWorkspace(actor, query.workspaceId);
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
      workspaceIds = memberships.map(({ workspaceId }) => workspaceId);
    }
    if (kind === 'PERSONA') {
      const [items, usage] = await Promise.all([this.prisma.persona.findMany({
        where: {
          tenantId, status: { not: RecordStatus.REMOVED },
          ...(workspaceIds ? { workspaces: { some: { workspaceId: { in: workspaceIds }, disassociatedAt: null } } } : {}),
        },
        include: {
          workspaces: { where: { disassociatedAt: null }, select: { workspaceId: true } },
        },
        orderBy: { createdAt: 'desc' },
      }), this.prisma.projectPersonaUsage.groupBy({
        by: ['personaId'], where: { tenantId, project: { status: RecordStatus.ACTIVE } }, _count: true,
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
        workspaces: { where: { disassociatedAt: null }, select: { workspaceId: true } },
      },
      orderBy: { createdAt: 'desc' },
    }), this.prisma.projectQuestionnaireUsage.groupBy({
      by: ['questionnaireId'], where: { tenantId, project: { status: RecordStatus.ACTIVE } }, _count: true,
    })]);
    const usageCounts = new Map(usage.map((item) => [item.questionnaireId, item._count]));
    return items.map(({ workspaces, ...item }) => ({
      ...item, workspaceIds: workspaces.map(({ workspaceId }) => workspaceId), activeProjectUsageCount: usageCounts.get(item.id) ?? 0,
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
    const feature = this.feature(kind);
    for (const workspaceId of workspaceIds) {
      const workspace = await this.access.requireFeature(actor, { workspaceId, feature, level: PermissionLevel.WRITE });
      if (workspace.tenantId !== tenantId) throw new NotFoundException('Workspace não encontrado.');
    }
    return this.prisma.$transaction(async (tx) => {
      const asset = kind === 'PERSONA'
        ? await tx.persona.create({ data: { tenantId, name: input.name.trim(), description: input.description?.trim(), data: input.data as Prisma.InputJsonValue } })
        : await tx.questionnaire.create({ data: { tenantId, name: input.name.trim(), description: input.description?.trim(), data: input.data as Prisma.InputJsonValue } });
      // Association is a separate admin capability; auto-associate only for scoped/global admins.
      for (const workspaceId of workspaceIds) {
        if (admin || await this.isWorkspaceAdminTx(tx, actor.id, workspaceId)) {
          await this.associateTx(tx, kind, tenantId, asset.id, workspaceId, actor.id);
        }
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: kind === 'PERSONA' ? 'PERSONA_CREATED' : 'QUESTIONNAIRE_CREATED',
          targetType: kind === 'PERSONA' ? 'Persona' : 'Questionnaire', targetId: asset.id,
          scopeType: 'TENANT', scopeId: tenantId, metadata: { requestedWorkspaceIds: workspaceIds },
        },
      });
      return { ...asset, workspaceIds };
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
    await this.prisma.$transaction((tx) => this.associateTx(tx, kind, tenantId, assetId, workspaceId, actor.id));
    return { associated: true, assetId, workspaceId };
  }

  async disassociate(kind: Kind, tenantId: string, assetId: string, workspaceId: string, actor: Principal) {
    const workspace = await this.access.requireWorkspace(actor, workspaceId, true);
    if (workspace.tenantId !== tenantId) throw new NotFoundException('Workspace não encontrado.');
    await this.requireAsset(kind, tenantId, assetId);
    await this.prisma.$transaction(async (tx) => {
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
    });
    return { associated: false, assetId, workspaceId };
  }

  async recordUsage(rawType: string, projectId: string, assetId: string, actor: Principal) {
    const kind = this.parseKind(rawType);
    const project = await this.access.requireProject(actor, projectId);
    await this.access.requireFeature(actor, {
      workspaceId: project.workspaceId, projectId, feature: this.feature(kind), level: PermissionLevel.WRITE,
    });
    const asset = await this.requireAsset(kind, project.tenantId, assetId);
    const associated = kind === 'PERSONA'
      ? await this.prisma.workspacePersona.count({ where: { workspaceId: project.workspaceId, personaId: assetId, disassociatedAt: null } })
      : await this.prisma.workspaceQuestionnaire.count({ where: { workspaceId: project.workspaceId, questionnaireId: assetId, disassociatedAt: null } });
    if (!associated) throw new ConflictException('O ativo não está associado ao workspace do projeto.');
    const snapshot = { id: asset.id, name: asset.name, description: asset.description, data: asset.data, version: asset.version } as Prisma.InputJsonValue;
    return this.prisma.$transaction(async (tx) => {
      const usage = kind === 'PERSONA'
        ? await tx.projectPersonaUsage.create({ data: { tenantId: project.tenantId, workspaceId: project.workspaceId, projectId, personaId: assetId, version: asset.version, snapshot } })
        : await tx.projectQuestionnaireUsage.create({ data: { tenantId: project.tenantId, workspaceId: project.workspaceId, projectId, questionnaireId: assetId, version: asset.version, snapshot } });
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
    await this.access.requireProject(actor, projectId);
    const [personas, questionnaires] = await Promise.all([
      this.prisma.projectPersonaUsage.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.projectQuestionnaireUsage.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      personas: personas.map((item) => ({ ...item, assetType: 'PERSONA' as const, sourceAssetId: item.personaId })),
      questionnaires: questionnaires.map((item) => ({ ...item, assetType: 'QUESTIONNAIRE' as const, sourceAssetId: item.questionnaireId })),
    };
  }

  private async associateTx(tx: Prisma.TransactionClient, kind: Kind, tenantId: string, assetId: string, workspaceId: string, actorId: string) {
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

  private async isWorkspaceAdminTx(tx: Prisma.TransactionClient, userId: string, workspaceId: string) {
    return (await tx.workspaceMembership.count({
      where: { userId, workspaceId, role: 'WORKSPACE_ADMIN', status: MembershipStatus.ACTIVE },
    })) > 0;
  }

  private feature(kind: Kind) { return kind === 'PERSONA' ? Feature.PERSONA : Feature.RESEARCH; }
  private parseKind(raw: string): Kind {
    if (raw === 'persona' || raw === 'personas' || raw === 'PERSONA') return 'PERSONA';
    if (raw === 'questionnaire' || raw === 'questionnaires' || raw === 'QUESTIONNAIRE') return 'QUESTIONNAIRE';
    throw new BadRequestException('Tipo de ativo inválido.');
  }
}
