import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientRole, Feature, MembershipStatus, PermissionEffect, PermissionLevel,
  Prisma, ProjectPermission, WorkspaceRole,
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
            workspace: {
              select: {
                id: true, name: true, slug: true, isDefault: true,
                _count: { select: { projects: { where: { status: 'ACTIVE' } } } },
              },
            },
            workspacePermissions: { select: { feature: true, level: true, effect: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        projectMemberships: {
          where: { project: { status: 'ACTIVE' } },
          select: { id: true },
        },
        projectPermissions: {
          where: { effect: PermissionEffect.ALLOW, project: { status: 'ACTIVE' } },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(({ user, projectMemberships, projectPermissions, ...membership }) => ({
      ...membership,
      selected: user.tenantId === membership.tenantId,
      hasProjectAccess: membership.role === ClientRole.CLIENT_ADMIN
        || projectMemberships.length > 0
        || projectPermissions.length > 0
        || membership.workspaceMemberships.some(({ workspace }) => workspace._count.projects > 0),
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
    if (!tenant) throw new NotFoundException('Organização não encontrada.');
    if (this.isSuper(actor)) return tenant;
    const membership = await this.prisma.clientMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: actor.id } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE || (admin && membership.role !== ClientRole.CLIENT_ADMIN)) {
      throw new NotFoundException('Organização não encontrada.');
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
    workspaceId?: string | null;
    projectId?: string;
    feature: Feature;
    level: PermissionLevel;
  }) {
    const project = input.projectId ? await this.requireProject(actor, input.projectId) : null;
    if (project && input.workspaceId && project.workspaceId !== input.workspaceId) {
      throw new NotFoundException('Projeto não encontrado.');
    }
    const workspaceId = project?.workspaceId ?? input.workspaceId ?? null;
    const workspace = !project && workspaceId ? await this.requireWorkspace(actor, workspaceId) : null;
    if (!project && !workspace) throw new ForbiddenException('Informe um projeto ou workspace válido.');
    if (this.isSuper(actor)) return project ?? workspace!;
    const tenantId = project?.tenantId ?? workspace!.tenantId;
    const clientAdmin = await this.prisma.clientMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: actor.id } },
      select: { role: true, status: true },
    });
    if (clientAdmin?.status === MembershipStatus.ACTIVE && clientAdmin.role === ClientRole.CLIENT_ADMIN) return project ?? workspace!;

    if (project) {
      const [projectRule, projectMembership] = await Promise.all([
        this.prisma.projectFunctionalPermission.findUnique({
          where: { projectId_userId_feature: { projectId: project.id, userId: actor.id, feature: input.feature } },
          select: { level: true, effect: true },
        }),
        this.prisma.projectMembership.findUnique({
          where: { projectId_userId: { projectId: project.id, userId: actor.id } },
          select: { permission: true },
        }),
      ]);
      if (projectRule) {
        if (projectRule.effect === PermissionEffect.DENY || rank[projectRule.level] < rank[input.level]) {
          throw new ForbiddenException('Permissão funcional insuficiente.');
        }
        return project;
      }
      const inheritedLevel: Record<ProjectPermission, PermissionLevel> = {
        [ProjectPermission.OWNER]: PermissionLevel.ADMIN,
        [ProjectPermission.MANAGER]: PermissionLevel.ADMIN,
        [ProjectPermission.CONTRIBUTOR]: PermissionLevel.WRITE,
        [ProjectPermission.VIEWER]: PermissionLevel.READ,
      };
      if (projectMembership) {
        if (rank[inheritedLevel[projectMembership.permission]] < rank[input.level]) {
          throw new ForbiddenException('Permissão funcional insuficiente.');
        }
        return project;
      }
    }

    if (!workspaceId) {
      if (project) {
        throw new ForbiddenException('Permissão funcional insuficiente.');
      }
      throw new ForbiddenException('Acesso não permitido.');
    }

    const authorizedWorkspace = await this.requireWorkspace(actor, workspaceId);
    const workspaceMembership = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actor.id } },
      select: { role: true, status: true },
    });
    if (workspaceMembership?.status !== MembershipStatus.ACTIVE) throw new ForbiddenException('Acesso não permitido.');
    if (workspaceMembership.role === WorkspaceRole.WORKSPACE_ADMIN) return project ?? authorizedWorkspace;
    const workspaceRule = await this.prisma.workspacePermission.findUnique({
      where: { workspaceId_userId_feature: { workspaceId, userId: actor.id, feature: input.feature } },
      select: { level: true, effect: true },
    });
    if (!workspaceRule || workspaceRule.effect === PermissionEffect.DENY || rank[workspaceRule.level] < rank[input.level]) {
      throw new ForbiddenException('Permissão funcional insuficiente.');
    }
    return project ?? authorizedWorkspace;
  }

  async requireProject(actor: Principal, projectId: string, admin = false) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, status: 'ACTIVE' },
      select: { id: true, tenantId: true, workspaceId: true, status: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    if (this.isSuper(actor)) return project;
    const clientMembership = await this.prisma.clientMembership.findUnique({
      where: { tenantId_userId: { tenantId: project.tenantId, userId: actor.id } },
      select: { role: true, status: true },
    });
    if (clientMembership?.status !== MembershipStatus.ACTIVE) throw new NotFoundException('Projeto não encontrado.');
    if (clientMembership.role === ClientRole.CLIENT_ADMIN) return project;

    const [projectMembership, projectPermission, workspaceMembership] = await Promise.all([
      this.prisma.projectMembership.findUnique({
        where: { projectId_userId: { projectId, userId: actor.id } },
        select: { permission: true },
      }),
      this.prisma.projectFunctionalPermission.findFirst({
        where: { projectId, userId: actor.id, effect: PermissionEffect.ALLOW },
        select: { id: true },
      }),
      project.workspaceId
        ? this.prisma.workspaceMembership.findUnique({
            where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: actor.id } },
            select: { role: true, status: true },
          })
        : Promise.resolve(null),
    ]);
    const workspaceAccess = workspaceMembership?.status === MembershipStatus.ACTIVE;
    const projectAdmin = projectMembership?.permission === ProjectPermission.OWNER
      || projectMembership?.permission === ProjectPermission.MANAGER;
    if (admin ? (!projectAdmin && !(workspaceAccess && workspaceMembership.role === WorkspaceRole.WORKSPACE_ADMIN))
      : (!projectMembership && !projectPermission && !workspaceAccess)) {
      throw new NotFoundException('Projeto não encontrado.');
    }
    return project;
  }

  async lockTenant(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))`;
  }

  async lockWorkspace(tx: Prisma.TransactionClient, workspaceId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))`;
  }
}
