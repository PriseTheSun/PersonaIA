import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectPermission, RecordStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { normalizeEmail, redactUser } from '../common/security';
import { Principal } from '../common/types/principal';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectUserInput, UpdateProjectUserInput, UpdateUserAccessInput } from './users.schemas';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  async list(actor: Principal) {
    const tenantId = this.tenantId(actor);
    const users = await this.prisma.user.findMany({
      where: { tenantId, role: Role.PROJECT_USER },
      select: {
        id: true, tenantId: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true, updatedAt: true,
        _count: { select: { memberships: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return users.map(({ _count, ...user }) => ({ ...user, projectCount: _count.memberships }));
  }

  async listAccess(actor: Principal) {
    const users = await this.prisma.user.findMany({
      where: actor.role === Role.SUPER_ADMIN ? undefined : { tenantId: this.tenantId(actor) },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
        _count: { select: { memberships: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return users.map(({ _count, ...user }) => ({ ...user, projectCount: _count.memberships }));
  }

  async updateAccess(id: string, input: UpdateUserAccessInput, actor: Principal) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, tenantId: true, role: true, status: true, name: true, email: true }
    });
    const clientCanManage = actor.role === Role.CLIENT_ADMIN
      && existing?.tenantId === actor.tenantId
      && existing.role === Role.PROJECT_USER;
    if (!existing || (actor.role !== Role.SUPER_ADMIN && !clientCanManage)) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (actor.role === Role.CLIENT_ADMIN && (input.role !== undefined || input.tenantId !== undefined)) {
      throw new ForbiddenException('Apenas o superadministrador pode alterar perfis administrativos.');
    }
    if (actor.id === id && (input.role !== undefined || input.status !== undefined || input.tenantId !== undefined)) {
      throw new ForbiddenException('Você não pode alterar o acesso da própria conta.');
    }

    const nextRole = (input.role ?? existing.role) as Role;
    const nextStatus = (input.status ?? existing.status) as RecordStatus;
    const nextTenantId = nextRole === Role.SUPER_ADMIN
      ? null
      : input.tenantId !== undefined ? input.tenantId : existing.tenantId;

    if (nextRole !== Role.SUPER_ADMIN) {
      if (!nextTenantId) throw new ConflictException('Selecione um cliente para este perfil.');
      const activeTenant = await this.prisma.tenant.findFirst({
        where: { id: nextTenantId, status: RecordStatus.ACTIVE },
        select: { id: true }
      });
      if (!activeTenant) throw new NotFoundException('Cliente ativo não encontrado.');
    }

    const deactivatesSuper = existing.role === Role.SUPER_ADMIN
      && existing.status === RecordStatus.ACTIVE
      && (nextRole !== Role.SUPER_ADMIN || nextStatus !== RecordStatus.ACTIVE);
    if (deactivatesSuper) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: { role: Role.SUPER_ADMIN, status: RecordStatus.ACTIVE }
      });
      if (activeSuperAdmins <= 1) throw new ConflictException('Mantenha pelo menos um superadministrador ativo.');
    }

    const accessChanged = nextRole !== existing.role || nextStatus !== existing.status || nextTenantId !== existing.tenantId;
    const removeMemberships = existing.tenantId !== nextTenantId || nextRole !== Role.PROJECT_USER;
    const resolvesAccessRequest = existing.status === RecordStatus.PENDING
      && (nextStatus === RecordStatus.ACTIVE || nextStatus === RecordStatus.ARCHIVED);
    const auditAction = resolvesAccessRequest
      ? nextStatus === RecordStatus.ACTIVE ? 'USER_ACCESS_APPROVED' : 'USER_ACCESS_REJECTED'
      : 'USER_ACCESS_UPDATED';
    const updated = await this.prisma.$transaction(async (tx) => {
      const membershipsRemoved = removeMemberships
        ? (await tx.projectMembership.deleteMany({ where: { userId: id } })).count
        : 0;
      const user = await tx.user.update({
        where: { id },
        data: {
          role: nextRole,
          status: nextStatus,
          tenantId: nextTenantId,
          ...(accessChanged ? { tokenVersion: { increment: 1 } } : {})
        }
      });
      if (accessChanged) {
        await tx.refreshSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }
      if (resolvesAccessRequest && existing.tenantId) await this.notifications.resolveAccessRequest(tx, id, existing.tenantId);
      await tx.auditLog.create({
        data: {
          tenantId: nextTenantId,
          actorId: actor.id,
          action: auditAction,
          targetType: 'User',
          targetId: id,
          metadata: {
            previous: { role: existing.role, status: existing.status, tenantId: existing.tenantId },
            next: { role: nextRole, status: nextStatus, tenantId: nextTenantId },
            membershipsRemoved
          }
        }
      });
      return user;
    });
    return redactUser(updated);
  }

  async get(id: string, actor: Principal) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId: this.tenantId(actor), role: Role.PROJECT_USER },
      select: { id: true, tenantId: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true, memberships: { include: { project: true } } }
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  async create(input: CreateProjectUserInput, actor: Principal) {
    const tenantId = this.tenantId(actor);
    const projectIds = [...new Set(input.projectIds)];
    if (projectIds.length) {
      const count = await this.prisma.project.count({ where: { id: { in: projectIds }, tenantId, status: RecordStatus.ACTIVE } });
      if (count !== projectIds.length) throw new NotFoundException('Um ou mais projetos não foram encontrados.');
    }
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { tenantId, name: input.name.trim(), email: normalizeEmail(input.email), passwordHash, role: Role.PROJECT_USER }
        });
        if (projectIds.length) {
          await tx.projectMembership.createMany({ data: projectIds.map((projectId) => ({ tenantId, projectId, userId: created.id, permission: input.permission as ProjectPermission })) });
        }
        await tx.auditLog.create({ data: { tenantId, actorId: actor.id, action: 'PROJECT_USER_CREATED', targetType: 'User', targetId: created.id } });
        return created;
      });
      return redactUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('E-mail já cadastrado.');
      throw error;
    }
  }

  async update(id: string, input: UpdateProjectUserInput, actor: Principal) {
    const tenantId = this.tenantId(actor);
    const existing = await this.prisma.user.findFirst({ where: { id, tenantId, role: Role.PROJECT_USER }, select: { id: true } });
    if (!existing) throw new NotFoundException('Usuário não encontrado.');
    const passwordHash = input.password
      ? await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 })
      : undefined;
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.status ? { status: input.status as RecordStatus } : {}),
          ...(passwordHash ? { passwordHash, tokenVersion: { increment: 1 } } : {})
        }
      });
      if (passwordHash || input.status === 'SUSPENDED') {
        await tx.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.auditLog.create({ data: { tenantId, actorId: actor.id, action: 'PROJECT_USER_UPDATED', targetType: 'User', targetId: id, metadata: { changed: Object.keys(input) } } });
      return updated;
    });
    return redactUser(user);
  }

  private tenantId(actor: Principal) {
    if (!actor.tenantId) throw new NotFoundException('Organização não encontrada.');
    return actor.tenantId;
  }
}
