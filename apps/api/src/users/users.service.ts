import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectPermission, RecordStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { normalizeEmail, redactUser } from '../common/security';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectUserInput, UpdateProjectUserInput } from './users.schemas';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
