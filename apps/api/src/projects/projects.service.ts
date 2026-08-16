import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  ClientRole, Feature, MembershipStatus, PermissionEffect, PermissionLevel,
  Prisma, ProjectPermission, RecordStatus,
} from '@prisma/client';
import { AccessControlService } from '../common/access-control.service';
import { normalizeSlug } from '../common/security';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddMemberInput, CreateProjectInput, MoveMemberInput, ProjectQuery,
  ReplaceProjectPermissionsInput, UpdatePermissionInput, UpdateProjectInput,
} from './projects.schemas';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly access?: AccessControlService) {}

  async list(actor: Principal, query: ProjectQuery = {}) {
    const where: Prisma.ProjectWhereInput = { status: { not: RecordStatus.REMOVED } };
    if (query.workspaceId) {
      await this.accessControl().requireWorkspace(actor, query.workspaceId);
      where.workspaceId = query.workspaceId;
    } else if (query.tenantId) {
      await this.accessControl().requireTenant(actor, query.tenantId);
      where.tenantId = query.tenantId;
      if (!this.accessControl().isSuper(actor) && !await this.isClientAdmin(actor.id, query.tenantId)) {
        where.OR = [
          { workspace: { memberships: { some: { userId: actor.id, status: MembershipStatus.ACTIVE } } } },
          { memberships: { some: { userId: actor.id, clientMembership: { status: MembershipStatus.ACTIVE } } } },
          { permissions: { some: { userId: actor.id, effect: PermissionEffect.ALLOW, membership: { status: MembershipStatus.ACTIVE } } } },
        ];
      }
    } else if (!this.accessControl().isSuper(actor)) {
      const [clientAdmins, workspaceMemberships] = await Promise.all([
        this.prisma.clientMembership.findMany({
          where: { userId: actor.id, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE, tenant: { status: RecordStatus.ACTIVE } },
          select: { tenantId: true },
        }),
        this.prisma.workspaceMembership.findMany({
          where: { userId: actor.id, status: MembershipStatus.ACTIVE, workspace: { status: RecordStatus.ACTIVE }, clientMembership: { status: MembershipStatus.ACTIVE } },
          select: { workspaceId: true },
        }),
      ]);
      where.OR = [
        { tenantId: { in: clientAdmins.map(({ tenantId }) => tenantId) } },
        { workspaceId: { in: workspaceMemberships.map(({ workspaceId }) => workspaceId) } },
        { memberships: { some: { userId: actor.id, clientMembership: { status: MembershipStatus.ACTIVE } } } },
        { permissions: { some: { userId: actor.id, effect: PermissionEffect.ALLOW, membership: { status: MembershipStatus.ACTIVE } } } },
      ];
    }
    const projects = await this.prisma.project.findMany({
      where,
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map(({ _count, ...project }) => ({ ...project, memberCount: _count.memberships }));
  }

  async get(id: string, actor: Principal) {
    await this.accessControl().requireProject(actor, id);
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { workspace: true, _count: { select: { memberships: true } } },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    const { _count, ...data } = project;
    return { ...data, memberCount: _count.memberships };
  }

  async create(input: CreateProjectInput, actor: Principal) {
    const workspace = input.workspaceId ? await this.accessControl().requireWorkspace(actor, input.workspaceId) : null;
    const tenantId = workspace?.tenantId ?? input.tenantId ?? actor.tenantId;
    if (!tenantId || (workspace && input.tenantId && workspace.tenantId !== input.tenantId)) {
      throw new NotFoundException('Organização não encontrada.');
    }
    if (workspace) {
      await this.accessControl().requireFeature(actor, {
        workspaceId: workspace.id, feature: Feature.PERSONA, level: PermissionLevel.WRITE,
      });
    } else {
      await this.accessControl().requireTenant(actor, tenantId, true);
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.accessControl().lockTenant(tx, tenantId);
        if (workspace) {
          await this.accessControl().lockWorkspace(tx, workspace.id);
          const activeWorkspace = await tx.workspace.count({
            where: { id: workspace.id, tenantId, status: RecordStatus.ACTIVE, tenant: { status: RecordStatus.ACTIVE } },
          });
          if (!activeWorkspace) throw new NotFoundException('Workspace não encontrado.');
        }
        const project = await tx.project.create({
          data: {
            tenantId, workspaceId: workspace?.id ?? null,
            name: input.name.trim(), slug: normalizeSlug(input.slug ?? input.name), description: input.description?.trim(),
          },
        });
        await tx.auditLog.create({
          data: {
            tenantId, actorId: actor.id, action: 'PROJECT_CREATED', targetType: 'Project', targetId: project.id,
            scopeType: 'PROJECT', scopeId: project.id, metadata: { workspaceId: workspace?.id ?? null },
          },
        });
        return project;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um projeto com esse slug nesta organização.');
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateProjectInput, actor: Principal) {
    const projectContext = await this.accessControl().requireProject(actor, id, true);
    let nextWorkspaceId: string | null | undefined;
    if (input.workspaceId !== undefined) {
      await this.accessControl().requireTenant(actor, projectContext.tenantId, true);
      if (input.workspaceId) {
        const workspace = await this.accessControl().requireWorkspace(actor, input.workspaceId, true);
        if (workspace.tenantId !== projectContext.tenantId) throw new NotFoundException('Workspace não encontrado.');
        nextWorkspaceId = workspace.id;
      } else {
        nextWorkspaceId = null;
      }
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (nextWorkspaceId !== undefined) {
          await this.accessControl().lockTenant(tx, projectContext.tenantId);
          if (nextWorkspaceId) {
            await this.accessControl().lockWorkspace(tx, nextWorkspaceId);
            const activeWorkspace = await tx.workspace.count({
              where: { id: nextWorkspaceId, tenantId: projectContext.tenantId, status: RecordStatus.ACTIVE },
            });
            if (!activeWorkspace) throw new NotFoundException('Workspace não encontrado.');
          }
        }
        const project = await tx.project.update({
          where: { id },
          data: {
            ...(input.name ? { name: input.name.trim() } : {}),
            ...(input.description !== undefined ? { description: input.description?.trim() ?? null } : {}),
            ...(input.status ? { status: input.status as RecordStatus } : {}),
            ...(nextWorkspaceId !== undefined ? { workspaceId: nextWorkspaceId } : {}),
          },
        });
        await tx.auditLog.create({
          data: {
            tenantId: projectContext.tenantId, actorId: actor.id, action: 'PROJECT_UPDATED', targetType: 'Project', targetId: id,
            scopeType: 'PROJECT', scopeId: id, metadata: { changed: Object.keys(input) },
          },
        });
        return project;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('A organização do projeto foi alterada por outra operação. Recarregue e tente novamente.');
      }
      throw error;
    }
  }

  async remove(id: string, actor: Principal) {
    const project = await this.accessControl().requireProject(actor, id, true);
    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id }, data: { status: RecordStatus.REMOVED } });
      await tx.auditLog.create({
        data: {
          tenantId: project.tenantId, actorId: actor.id, action: 'PROJECT_REMOVED', targetType: 'Project', targetId: id,
          scopeType: 'PROJECT', scopeId: id,
        },
      });
    });
    return { success: true };
  }

  async listMembers(projectId: string, actor: Principal) {
    const project = await this.accessControl().requireProject(actor, projectId, true);
    if (!project.workspaceId) {
      const memberships = await this.prisma.clientMembership.findMany({
        where: { tenantId: project.tenantId, status: MembershipStatus.ACTIVE },
        select: {
          id: true, tenantId: true, userId: true, role: true, status: true, createdAt: true, updatedAt: true,
          user: { select: { id: true, tenantId: true, name: true, email: true, role: true, status: true, createdAt: true } },
          projectPermissions: {
            where: { projectId }, select: { feature: true, level: true, effect: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return memberships.map(({ projectPermissions, ...membership }) => ({
        ...membership,
        permissions: projectPermissions,
        workspacePermissions: [],
        effectivePermissions: projectPermissions,
      }));
    }
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { workspaceId: project.workspaceId, status: MembershipStatus.ACTIVE },
      select: {
        id: true, tenantId: true, workspaceId: true, userId: true, role: true, status: true, createdAt: true, updatedAt: true,
        user: {
          select: {
            id: true, tenantId: true, name: true, email: true, role: true, status: true, createdAt: true,
            projectPermissions: {
              where: { projectId }, select: { feature: true, level: true, effect: true },
            },
          },
        },
        workspacePermissions: { select: { feature: true, level: true, effect: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return memberships.map(({ workspacePermissions, user: { projectPermissions, ...user }, ...membership }) => {
      const overrides = new Map(projectPermissions.map((permission) => [permission.feature, permission]));
      const inherited = new Map(workspacePermissions.map((permission) => [permission.feature, permission]));
      const features = new Set([...overrides.keys(), ...inherited.keys()]);
      return {
        ...membership, user,
        permissions: projectPermissions,
        workspacePermissions,
        effectivePermissions: [...features].map((feature) => overrides.get(feature) ?? inherited.get(feature)!),
      };
    });
  }

  async addMember(projectId: string, input: AddMemberInput, actor: Principal) {
    const project = await this.accessControl().requireProject(actor, projectId, true);
    this.assertCanGrant(input.permission, actor);
    await this.requireClientUser(input.userId, project.tenantId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const membership = await tx.projectMembership.create({
          data: { tenantId: project.tenantId, projectId, userId: input.userId, permission: input.permission as ProjectPermission },
        });
        await tx.auditLog.create({
          data: {
            tenantId: project.tenantId, actorId: actor.id, action: 'PROJECT_MEMBER_ADDED', targetType: 'ProjectMembership', targetId: membership.id,
            scopeType: 'PROJECT', scopeId: projectId, metadata: { userId: input.userId, permission: input.permission },
          },
        });
        return this.membershipDto(membership);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Usuário já pertence ao projeto.');
      }
      throw error;
    }
  }

  async updatePermission(projectId: string, userId: string, input: UpdatePermissionInput, actor: Principal) {
    // Compatibility preset. Functional permissions are configured through PUT below.
    const project = this.access
      ? await this.access.requireProject(actor, projectId, true)
      : await this.requireLegacyProject(projectId, actor);
    this.assertCanGrant(input.permission, actor);
    const existing = await this.prisma.projectMembership.findFirst({
      where: { tenantId: project.tenantId, projectId, userId }, select: { id: true },
    });
    if (!existing) throw new NotFoundException('Membro não encontrado no projeto.');
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.projectMembership.update({
        where: { id: existing.id }, data: { permission: input.permission as ProjectPermission },
      });
      await tx.auditLog.create({
        data: {
          tenantId: project.tenantId, actorId: actor.id, action: 'PROJECT_PERMISSION_CHANGED', targetType: 'ProjectMembership', targetId: membership.id,
          scopeType: 'PROJECT', scopeId: projectId, metadata: { userId, permission: input.permission },
        },
      });
      return this.membershipDto(membership);
    });
  }

  async getFunctionalPermissions(projectId: string, userId: string, actor: Principal) {
    await this.accessControl().requireProject(actor, projectId, true);
    return this.prisma.projectFunctionalPermission.findMany({ where: { projectId, userId }, orderBy: { feature: 'asc' } });
  }

  async replaceFunctionalPermissions(projectId: string, userId: string, input: ReplaceProjectPermissionsInput, actor: Principal) {
    const project = await this.accessControl().requireProject(actor, projectId, true);
    await this.requireClientUser(userId, project.tenantId);
    return this.prisma.$transaction(async (tx) => {
      await tx.projectFunctionalPermission.deleteMany({
        where: {
          projectId, userId,
          ...(input.permissions.length ? { feature: { notIn: input.permissions.map(({ feature }) => feature as Feature) } } : {}),
        },
      });
      for (const permission of input.permissions) {
        await tx.projectFunctionalPermission.upsert({
          where: { projectId_userId_feature: { projectId, userId, feature: permission.feature as Feature } },
          update: { level: permission.level as PermissionLevel, effect: permission.effect as PermissionEffect },
          create: {
            tenantId: project.tenantId, projectId, userId,
            feature: permission.feature as Feature, level: permission.level as PermissionLevel,
            effect: permission.effect as PermissionEffect,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId: project.tenantId, actorId: actor.id, action: 'PROJECT_PERMISSIONS_REPLACED', targetType: 'Project', targetId: projectId,
          scopeType: 'PROJECT', scopeId: projectId, metadata: { userId, permissions: input.permissions },
        },
      });
      return tx.projectFunctionalPermission.findMany({ where: { projectId, userId }, orderBy: { feature: 'asc' } });
    });
  }

  async removeMember(projectId: string, userId: string, actor: Principal) {
    const project = await this.accessControl().requireProject(actor, projectId, true);
    const existing = await this.prisma.projectMembership.findFirst({ where: { projectId, userId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Membro não encontrado no projeto.');
    await this.prisma.$transaction(async (tx) => {
      await tx.projectMembership.delete({ where: { id: existing.id } });
      await tx.projectFunctionalPermission.deleteMany({ where: { projectId, userId } });
      await tx.auditLog.create({
        data: {
          tenantId: project.tenantId, actorId: actor.id, action: 'PROJECT_MEMBER_REMOVED', targetType: 'ProjectMembership', targetId: existing.id,
          scopeType: 'PROJECT', scopeId: projectId, metadata: { userId },
        },
      });
    });
    return { success: true };
  }

  async moveMember(fromProjectId: string, input: MoveMemberInput, actor: Principal) {
    if (fromProjectId === input.toProjectId) throw new BadRequestException('O projeto de destino deve ser diferente.');
    const [sourceProject, destinationProject] = await Promise.all([
      this.accessControl().requireProject(actor, fromProjectId, true),
      this.accessControl().requireProject(actor, input.toProjectId, true),
    ]);
    if (sourceProject.tenantId !== destinationProject.tenantId && !this.accessControl().isSuper(actor)) {
      throw new BadRequestException('Não é permitido mover membros entre organizações.');
    }
    await this.requireClientUser(input.userId, destinationProject.tenantId);
    const source = await this.prisma.projectMembership.findFirst({
      where: { projectId: fromProjectId, userId: input.userId }, select: { id: true },
    });
    if (!source) throw new NotFoundException('Membro não encontrado no projeto de origem.');
    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.projectMembership.upsert({
        where: { projectId_userId: { projectId: input.toProjectId, userId: input.userId } },
        update: { permission: input.permission as ProjectPermission },
        create: {
          tenantId: destinationProject.tenantId, projectId: input.toProjectId,
          userId: input.userId, permission: input.permission as ProjectPermission,
        },
      });
      await tx.projectMembership.delete({ where: { id: source.id } });
      await tx.auditLog.create({
        data: {
          tenantId: sourceProject.tenantId, actorId: actor.id, action: 'PROJECT_MEMBER_MOVED', targetType: 'ProjectMembership', targetId: destination.id,
          scopeType: 'PROJECT', scopeId: input.toProjectId,
          metadata: { fromProjectId, toProjectId: input.toProjectId, userId: input.userId },
        },
      });
      return this.membershipDto(destination);
    });
  }

  private async requireClientUser(userId: string, tenantId: string) {
    const membership = await this.prisma.clientMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { status: true },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException('Usuário não possui vínculo ativo com a organização.');
    }
  }

  private async isClientAdmin(userId: string, tenantId: string) {
    return (await this.prisma.clientMembership.count({
      where: { userId, tenantId, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
    })) > 0;
  }

  private accessControl() {
    if (!this.access) throw new Error('AccessControlService não disponível.');
    return this.access;
  }

  private async requireLegacyProject(id: string, actor: Principal) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId: actor.tenantId ?? undefined, status: { not: RecordStatus.ARCHIVED } },
      select: { id: true, tenantId: true, workspaceId: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    return project;
  }

  private assertCanGrant(permission: string, actor: Principal) {
    if (permission === 'OWNER' && actor.role !== 'CLIENT_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new BadRequestException('Somente um administrador pode conceder o preset OWNER.');
    }
  }

  private membershipDto<T extends { permission: ProjectPermission }>(membership: T) {
    const { permission, ...data } = membership;
    return { ...data, permissions: [permission] };
  }
}
