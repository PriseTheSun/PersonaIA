import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientRole, Feature, MembershipStatus, PermissionEffect, PermissionLevel,
  Prisma, WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from './types/principal';

const rank: Record<PermissionLevel, number> = {
  [PermissionLevel.READ]: 1,
  [PermissionLevel.WRITE]: 2,
  [PermissionLevel.ADMIN]: 3,
};

export type PermissionInput = {
  feature: Feature;
  level: PermissionLevel;
  effect: PermissionEffect;
};

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  isSuper(actor: Principal) {
    return actor.role === 'SUPER_ADMIN';
  }

  async contexts(userId: string) {
    const memberships = await this.prisma.clientMembership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE, tenant: { status: 'ACTIVE' } },
      select: {
        tenantId: true, role: true, status: true,
        tenant: { select: { id: true, name: true, slug: true, status: true } },
        user: { select: { tenantId: true } },
        workspaceMemberships: {
          where: { status: MembershipStatus.ACTIVE, workspace: { status: 'ACTIVE' } },
          select: {
            workspaceId: true, role: true, status: true,
            workspace: { select: { id: true, name: true, slug: true, isDefault: true } },
            workspacePermissions: { select: { feature: true, level: true, effect: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(({ user, ...membership }) => ({
      ...membership,
      selected: user.tenantId === membership.tenantId,
      workspaces: membership.workspaceMemberships.map(({ workspacePermissions, ...item }) => ({
        ...item, permissions: workspacePermissions,
      })),
    }));
  }

  async requireTenant(actor: Principal, tenantId: string, admin = false) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, ...(this.isSuper(actor) ? { status: { not: 'REMOVED' } } : { status: 'ACTIVE' }) },
      select: { id: true, name: true, slug: true, status: true },
    });
    if (!tenant) throw new NotFoundException('Cliente não encontrado.');
    if (this.isSuper(actor)) return tenant;
    const membership = await this.prisma.clientMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: actor.id } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE || (admin && membership.role !== ClientRole.CLIENT_ADMIN)) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    return tenant;
  }

  async requireWorkspace(actor: Principal, workspaceId: string, admin = false) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        ...(this.isSuper(actor)
          ? { status: { not: 'REMOVED' } }
          : { status: 'ACTIVE', tenant: { status: 'ACTIVE' } }),
      },
      select: { id: true, tenantId: true, name: true, slug: true, status: true, isDefault: true },
    });
    if (!workspace) throw new NotFoundException('Workspace não encontrado.');
    if (this.isSuper(actor)) return workspace;
    const clientAdmin = await this.prisma.clientMembership.findUnique({
      where: { tenantId_userId: { tenantId: workspace.tenantId, userId: actor.id } },
      select: { role: true, status: true },
    });
    if (clientAdmin?.status === MembershipStatus.ACTIVE && clientAdmin.role === ClientRole.CLIENT_ADMIN) return workspace;
    const membership = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actor.id } },
      select: { role: true, status: true, clientMembership: { select: { status: true } } },
    });
    const active = membership?.status === MembershipStatus.ACTIVE && membership.clientMembership.status === MembershipStatus.ACTIVE;
    if (!active || (admin && membership.role !== WorkspaceRole.WORKSPACE_ADMIN)) {
      throw new NotFoundException('Workspace não encontrado.');
    }
    return workspace;
  }

  async requireFeature(actor: Principal, input: {
    workspaceId: string;
    projectId?: string;
    feature: Feature;
    level: PermissionLevel;
  }) {
    const workspace = await this.requireWorkspace(actor, input.workspaceId);
    if (this.isSuper(actor)) return workspace;
    const clientAdmin = await this.prisma.clientMembership.findUnique({
      where: { tenantId_userId: { tenantId: workspace.tenantId, userId: actor.id } },
      select: { role: true, status: true },
    });
    if (clientAdmin?.status === MembershipStatus.ACTIVE && clientAdmin.role === ClientRole.CLIENT_ADMIN) return workspace;
    const workspaceMembership = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: actor.id } },
      select: { role: true, status: true },
    });
    if (workspaceMembership?.status !== MembershipStatus.ACTIVE) throw new ForbiddenException('Acesso não permitido.');
    if (workspaceMembership.role === WorkspaceRole.WORKSPACE_ADMIN) return workspace;

    if (input.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: input.projectId, workspaceId: input.workspaceId, tenantId: workspace.tenantId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!project) throw new NotFoundException('Projeto não encontrado.');
      const projectRule = await this.prisma.projectFunctionalPermission.findUnique({
        where: { projectId_userId_feature: { projectId: input.projectId, userId: actor.id, feature: input.feature } },
        select: { level: true, effect: true },
      });
      if (projectRule) {
        if (projectRule.effect === PermissionEffect.DENY || rank[projectRule.level] < rank[input.level]) {
          throw new ForbiddenException('Permissão funcional insuficiente.');
        }
        return workspace;
      }
    }

    const workspaceRule = await this.prisma.workspacePermission.findUnique({
      where: { workspaceId_userId_feature: { workspaceId: input.workspaceId, userId: actor.id, feature: input.feature } },
      select: { level: true, effect: true },
    });
    if (!workspaceRule || workspaceRule.effect === PermissionEffect.DENY || rank[workspaceRule.level] < rank[input.level]) {
      throw new ForbiddenException('Permissão funcional insuficiente.');
    }
    return workspace;
  }

  async requireProject(actor: Principal, projectId: string, admin = false) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, status: 'ACTIVE' },
      select: { id: true, tenantId: true, workspaceId: true, status: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    await this.requireWorkspace(actor, project.workspaceId, admin);
    return project;
  }

  async lockTenant(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))`;
  }

  async lockWorkspace(tx: Prisma.TransactionClient, workspaceId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))`;
  }
}
