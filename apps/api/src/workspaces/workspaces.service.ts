import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientRole, Feature, MembershipStatus, PermissionEffect, PermissionLevel,
  Prisma, RecordStatus, WorkspaceRole,
} from '@prisma/client';
import { AccessControlService } from '../common/access-control.service';
import { normalizeSlug } from '../common/security';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddWorkspaceMemberInput, CreateWorkspaceInput, ReplacePermissionsInput,
  UpdateWorkspaceInput, UpdateWorkspaceMemberInput,
} from './workspaces.schemas';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService) {}

  async list(tenantId: string, actor: Principal) {
    await this.access.requireTenant(actor, tenantId);
    const isAdmin = this.access.isSuper(actor) || await this.isClientAdmin(actor.id, tenantId);
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        tenantId,
        status: isAdmin ? { not: RecordStatus.REMOVED } : RecordStatus.ACTIVE,
        ...(!isAdmin ? { memberships: { some: { userId: actor.id, status: MembershipStatus.ACTIVE } } } : {}),
      },
      include: {
        _count: {
          select: {
            memberships: { where: { status: MembershipStatus.ACTIVE } },
            projects: { where: { status: RecordStatus.ACTIVE } },
            personas: { where: { disassociatedAt: null } },
            questionnaires: { where: { disassociatedAt: null } },
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return workspaces.map(({ _count, ...workspace }) => ({
      ...workspace,
      memberCount: _count.memberships,
      projectCount: _count.projects,
      personaCount: _count.personas,
      questionnaireCount: _count.questionnaires,
      counts: _count,
    }));
  }

  async get(tenantId: string, workspaceId: string, actor: Principal) {
    const workspace = await this.access.requireWorkspace(actor, workspaceId);
    if (workspace.tenantId !== tenantId) throw new NotFoundException('Workspace não encontrado.');
    return this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: { select: { memberships: true, projects: true, personas: true, questionnaires: true } },
      },
    });
  }

  async create(tenantId: string, input: CreateWorkspaceInput, actor: Principal) {
    await this.access.requireTenant(actor, tenantId, true);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.access.lockTenant(tx, tenantId);
        const activeTenant = await tx.tenant.count({ where: { id: tenantId, status: RecordStatus.ACTIVE } });
        if (!activeTenant) throw new NotFoundException('Organização não encontrada.');
        const workspace = await tx.workspace.create({
          data: {
            tenantId,
            name: input.name.trim(),
            slug: normalizeSlug(input.slug ?? input.name),
            description: input.description?.trim(),
          },
        });
        const admins = await tx.clientMembership.findMany({
          where: { tenantId, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
          select: { userId: true },
        });
        if (admins.length === 0) throw new ConflictException('A organização precisa manter pelo menos um administrador ativo.');
        await tx.workspaceMembership.createMany({
          data: admins.map(({ userId }) => ({
            tenantId, workspaceId: workspace.id, userId,
            role: WorkspaceRole.WORKSPACE_ADMIN, status: MembershipStatus.ACTIVE,
            inheritedFromClientAdmin: true,
          })),
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id, tenantId, action: 'WORKSPACE_CREATED', targetType: 'Workspace', targetId: workspace.id,
            scopeType: 'WORKSPACE', scopeId: workspace.id,
          },
        });
        return workspace;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um workspace com esse slug.');
      }
      throw error;
    }
  }

  async update(tenantId: string, workspaceId: string, input: UpdateWorkspaceInput, actor: Principal) {
    await this.requireNestedAdmin(tenantId, workspaceId, actor);
    return this.serializable(async (tx) => {
      const workspace = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() ?? null } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: 'WORKSPACE_UPDATED', targetType: 'Workspace', targetId: workspaceId,
          scopeType: 'WORKSPACE', scopeId: workspaceId, metadata: { changed: Object.keys(input) },
        },
      });
      return workspace;
    });
  }

  async remove(tenantId: string, workspaceId: string, actor: Principal) {
    await this.requireNestedAdmin(tenantId, workspaceId, actor);
    await this.serializable(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      await this.access.lockWorkspace(tx, workspaceId);
      const ungrouped = await tx.project.updateMany({ where: { tenantId, workspaceId }, data: { workspaceId: null } });
      await tx.workspace.update({ where: { id: workspaceId }, data: { status: RecordStatus.REMOVED } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: 'WORKSPACE_REMOVED', targetType: 'Workspace', targetId: workspaceId,
          scopeType: 'WORKSPACE', scopeId: workspaceId, metadata: { ungroupedProjects: ungrouped.count },
        },
      });
    });
    return { success: true };
  }

  async listMembers(workspaceId: string, actor: Principal) {
    await this.access.requireWorkspace(actor, workspaceId, true);
    const members = await this.prisma.workspaceMembership.findMany({
      where: { workspaceId },
      select: {
        id: true, tenantId: true, workspaceId: true, userId: true, role: true, status: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, name: true, email: true, status: true, lastLoginAt: true } },
        workspacePermissions: { select: { feature: true, level: true, effect: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return members.map(({ workspacePermissions, ...member }) => ({
      ...member, permissions: workspacePermissions, workspacePermissions, effectivePermissions: workspacePermissions,
    }));
  }

  async addMember(workspaceId: string, input: AddWorkspaceMemberInput, actor: Principal) {
    const workspace = await this.access.requireWorkspace(actor, workspaceId, true);
    const clientMembership = await this.prisma.clientMembership.findUnique({
      where: { tenantId_userId: { tenantId: workspace.tenantId, userId: input.userId } },
    });
    if (!clientMembership || clientMembership.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException('O usuário não possui vínculo ativo com a organização.');
    }
    if (clientMembership.role === ClientRole.CLIENT_ADMIN) {
      throw new ConflictException('O administrador da organização já possui acesso administrativo automático ao workspace.');
    }
    return this.serializable(async (tx) => {
      const membership = await tx.workspaceMembership.upsert({
        where: { workspaceId_userId: { workspaceId, userId: input.userId } },
        update: { role: input.role, status: input.status, inheritedFromClientAdmin: false },
        create: { tenantId: workspace.tenantId, workspaceId, userId: input.userId, role: input.role, status: input.status, inheritedFromClientAdmin: false },
      });
      await this.replacePermissionsTx(tx, workspace.tenantId, workspaceId, input.userId, input.permissions);
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId: workspace.tenantId, action: 'WORKSPACE_MEMBER_ADDED',
          targetType: 'WorkspaceMembership', targetId: membership.id, scopeType: 'WORKSPACE', scopeId: workspaceId,
          metadata: { userId: input.userId, role: input.role, status: input.status, permissions: input.permissions },
        },
      });
      return membership;
    });
  }

  async updateMember(workspaceId: string, userId: string, input: UpdateWorkspaceMemberInput, actor: Principal) {
    const workspace = await this.access.requireWorkspace(actor, workspaceId, true);
    const existing = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!existing || existing.status === MembershipStatus.REMOVED) throw new NotFoundException('Membro não encontrado.');
    const inheritedClientAdmin = await this.prisma.clientMembership.count({
      where: { tenantId: workspace.tenantId, userId, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
    });
    if (inheritedClientAdmin && (input.role === WorkspaceRole.WORKSPACE_MEMBER || (input.status && input.status !== MembershipStatus.ACTIVE))) {
      throw new ConflictException('O administrador da organização possui acesso administrativo automático a todos os workspaces.');
    }
    const removesAdmin = existing.role === WorkspaceRole.WORKSPACE_ADMIN && existing.status === MembershipStatus.ACTIVE
      && (input.role === WorkspaceRole.WORKSPACE_MEMBER || (input.status && input.status !== MembershipStatus.ACTIVE));
    return this.serializable(async (tx) => {
      await this.access.lockWorkspace(tx, workspaceId);
      if (removesAdmin) {
        const admins = await tx.workspaceMembership.count({
          where: { workspaceId, role: WorkspaceRole.WORKSPACE_ADMIN, status: MembershipStatus.ACTIVE },
        });
        if (admins <= 1) throw new ConflictException('Mantenha pelo menos um WORKSPACE_ADMIN ativo.');
      }
      const membership = await tx.workspaceMembership.update({
        where: { id: existing.id }, data: {
          ...(input.role ? { role: input.role, inheritedFromClientAdmin: false } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId: workspace.tenantId, action: 'WORKSPACE_MEMBER_UPDATED',
          targetType: 'WorkspaceMembership', targetId: membership.id, scopeType: 'WORKSPACE', scopeId: workspaceId,
          metadata: { previous: { role: existing.role, status: existing.status }, next: input, userId },
        },
      });
      return membership;
    });
  }

  removeMember(workspaceId: string, userId: string, actor: Principal) {
    return this.updateMember(workspaceId, userId, { status: MembershipStatus.REMOVED }, actor);
  }

  async getPermissions(workspaceId: string, userId: string, actor: Principal) {
    await this.access.requireWorkspace(actor, workspaceId, true);
    const member = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }, select: { id: true },
    });
    if (!member) throw new NotFoundException('Membro não encontrado.');
    return this.prisma.workspacePermission.findMany({ where: { workspaceId, userId }, orderBy: { feature: 'asc' } });
  }

  async replacePermissions(workspaceId: string, userId: string, input: ReplacePermissionsInput, actor: Principal) {
    const workspace = await this.access.requireWorkspace(actor, workspaceId, true);
    const member = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member || member.status === MembershipStatus.REMOVED) throw new NotFoundException('Membro não encontrado.');
    return this.prisma.$transaction(async (tx) => {
      await this.replacePermissionsTx(tx, workspace.tenantId, workspaceId, userId, input.permissions);
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId: workspace.tenantId, action: 'WORKSPACE_PERMISSIONS_REPLACED',
          targetType: 'WorkspaceMembership', targetId: member.id, scopeType: 'WORKSPACE', scopeId: workspaceId,
          metadata: { userId, permissions: input.permissions },
        },
      });
      return this.getPermissionsUnsafe(tx, workspaceId, userId);
    });
  }

  private async replacePermissionsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    workspaceId: string,
    userId: string,
    permissions: ReplacePermissionsInput['permissions'],
  ) {
    await tx.workspacePermission.deleteMany({
      where: { workspaceId, userId, ...(permissions.length ? { feature: { notIn: permissions.map(({ feature }) => feature as Feature) } } : {}) },
    });
    for (const permission of permissions) {
      await tx.workspacePermission.upsert({
        where: { workspaceId_userId_feature: { workspaceId, userId, feature: permission.feature as Feature } },
        update: { level: permission.level as PermissionLevel, effect: permission.effect as PermissionEffect },
        create: {
          tenantId, workspaceId, userId, feature: permission.feature as Feature,
          level: permission.level as PermissionLevel, effect: permission.effect as PermissionEffect,
        },
      });
    }
  }

  private getPermissionsUnsafe(tx: Prisma.TransactionClient, workspaceId: string, userId: string) {
    return tx.workspacePermission.findMany({ where: { workspaceId, userId }, orderBy: { feature: 'asc' } });
  }

  private async requireNestedAdmin(tenantId: string, workspaceId: string, actor: Principal) {
    await this.access.requireTenant(actor, tenantId, true);
    const workspace = await this.prisma.workspace.findFirst({ where: { id: workspaceId, tenantId } });
    if (!workspace) throw new NotFoundException('Workspace não encontrado.');
    return workspace;
  }

  private async isClientAdmin(userId: string, tenantId: string) {
    const count = await this.prisma.clientMembership.count({
      where: { userId, tenantId, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
    });
    return count > 0;
  }

  private async serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('A operação conflitou com outra alteração. Recarregue os dados e tente novamente.');
      }
      throw error;
    }
  }
}
