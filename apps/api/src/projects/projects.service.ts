import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectPermission, RecordStatus, Role } from '@prisma/client';
import { normalizeSlug } from '../common/security';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberInput, CreateProjectInput, MoveMemberInput, UpdatePermissionInput, UpdateProjectInput } from './projects.schemas';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Principal) {
    const projects = await this.prisma.project.findMany({
      where: { tenantId: this.tenantId(actor) },
      include: { _count: { select: { memberships: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return projects.map(({ _count, ...project }) => ({ ...project, memberCount: _count.memberships }));
  }

  async get(id: string, actor: Principal) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId: this.tenantId(actor) },
      include: { _count: { select: { memberships: true } } }
    });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    const { _count, ...data } = project;
    return { ...data, memberCount: _count.memberships };
  }

  async create(input: CreateProjectInput, actor: Principal) {
    const tenantId = this.tenantId(actor);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: { tenantId, name: input.name.trim(), slug: normalizeSlug(input.slug ?? input.name), description: input.description?.trim() }
        });
        await tx.auditLog.create({ data: { tenantId, actorId: actor.id, action: 'PROJECT_CREATED', targetType: 'Project', targetId: project.id } });
        return project;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Já existe um projeto com esse slug.');
      throw error;
    }
  }

  async update(id: string, input: UpdateProjectInput, actor: Principal) {
    const tenantId = this.tenantId(actor);
    await this.requireProject(id, tenantId);
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() ?? null } : {}),
          ...(input.status ? { status: input.status as RecordStatus } : {})
        }
      });
      await tx.auditLog.create({ data: { tenantId, actorId: actor.id, action: 'PROJECT_UPDATED', targetType: 'Project', targetId: id, metadata: { changed: Object.keys(input) } } });
      return project;
    });
  }

  async listMembers(projectId: string, actor: Principal) {
    const tenantId = this.tenantId(actor);
    await this.requireProject(projectId, tenantId);
    const memberships = await this.prisma.projectMembership.findMany({
      where: { tenantId, projectId },
      select: { id: true, permission: true, createdAt: true, updatedAt: true, user: { select: { id: true, tenantId: true, name: true, email: true, role: true, status: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return memberships.map(({ permission, ...membership }) => ({ ...membership, permissions: [permission] }));
  }

  async addMember(projectId: string, input: AddMemberInput, actor: Principal) {
    const tenantId = this.tenantId(actor);
    this.assertCanGrant(input.permission, actor);
    await Promise.all([this.requireProject(projectId, tenantId), this.requireProjectUser(input.userId, tenantId)]);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const membership = await tx.projectMembership.create({ data: { tenantId, projectId, userId: input.userId, permission: input.permission as ProjectPermission } });
        await tx.auditLog.create({ data: { tenantId, actorId: actor.id, action: 'PROJECT_MEMBER_ADDED', targetType: 'ProjectMembership', targetId: membership.id, metadata: { projectId, userId: input.userId, permission: input.permission } } });
        return this.membershipDto(membership);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Usuário já pertence ao projeto.');
      throw error;
    }
  }

  async updatePermission(projectId: string, userId: string, input: UpdatePermissionInput, actor: Principal) {
    const tenantId = this.tenantId(actor);
    this.assertCanGrant(input.permission, actor);
    await this.requireProject(projectId, tenantId);
    const existing = await this.prisma.projectMembership.findFirst({ where: { tenantId, projectId, userId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Membro não encontrado no projeto.');
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.projectMembership.update({ where: { id: existing.id }, data: { permission: input.permission as ProjectPermission } });
      await tx.auditLog.create({ data: { tenantId, actorId: actor.id, action: 'PROJECT_PERMISSION_CHANGED', targetType: 'ProjectMembership', targetId: membership.id, metadata: { projectId, userId, permission: input.permission } } });
      return this.membershipDto(membership);
    });
  }

  async removeMember(projectId: string, userId: string, actor: Principal) {
    const tenantId = this.tenantId(actor);
    await this.requireProject(projectId, tenantId);
    const existing = await this.prisma.projectMembership.findFirst({ where: { tenantId, projectId, userId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Membro não encontrado no projeto.');
    await this.prisma.$transaction(async (tx) => {
      await tx.projectMembership.delete({ where: { id: existing.id } });
      await tx.auditLog.create({ data: { tenantId, actorId: actor.id, action: 'PROJECT_MEMBER_REMOVED', targetType: 'ProjectMembership', targetId: existing.id, metadata: { projectId, userId } } });
    });
    return { success: true };
  }

  async moveMember(fromProjectId: string, input: MoveMemberInput, actor: Principal) {
    const tenantId = this.tenantId(actor);
    this.assertCanGrant(input.permission, actor);
    if (fromProjectId === input.toProjectId) throw new BadRequestException('O projeto de destino deve ser diferente.');
    await Promise.all([this.requireProject(fromProjectId, tenantId), this.requireProject(input.toProjectId, tenantId), this.requireProjectUser(input.userId, tenantId)]);
    const source = await this.prisma.projectMembership.findFirst({ where: { tenantId, projectId: fromProjectId, userId: input.userId }, select: { id: true } });
    if (!source) throw new NotFoundException('Membro não encontrado no projeto de origem.');
    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.projectMembership.upsert({
        where: { projectId_userId: { projectId: input.toProjectId, userId: input.userId } },
        update: { permission: input.permission as ProjectPermission },
        create: { tenantId, projectId: input.toProjectId, userId: input.userId, permission: input.permission as ProjectPermission }
      });
      await tx.projectMembership.delete({ where: { id: source.id } });
      await tx.auditLog.create({ data: { tenantId, actorId: actor.id, action: 'PROJECT_MEMBER_MOVED', targetType: 'ProjectMembership', targetId: destination.id, metadata: { fromProjectId, toProjectId: input.toProjectId, userId: input.userId } } });
      return this.membershipDto(destination);
    });
  }

  private async requireProject(id: string, tenantId: string) {
    const project = await this.prisma.project.findFirst({ where: { id, tenantId, status: { not: RecordStatus.ARCHIVED } }, select: { id: true } });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    return project;
  }

  private async requireProjectUser(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId, role: Role.PROJECT_USER, status: RecordStatus.ACTIVE }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  private tenantId(actor: Principal) {
    if (!actor.tenantId || actor.role !== 'CLIENT_ADMIN') throw new NotFoundException('Organização não encontrada.');
    return actor.tenantId;
  }

  /** OWNER is a preset, not the final permission matrix; only the tenant's Client Admin may grant it. */
  private assertCanGrant(permission: string, actor: Principal) {
    if (permission === 'OWNER' && (actor.role !== 'CLIENT_ADMIN' || !actor.tenantId)) {
      throw new BadRequestException('Somente o administrador do cliente pode conceder o preset OWNER.');
    }
  }

  private membershipDto<T extends { permission: ProjectPermission }>(membership: T) {
    const { permission, ...data } = membership;
    return { ...data, permissions: [permission] };
  }
}
