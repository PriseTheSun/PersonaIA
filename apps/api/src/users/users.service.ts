import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientRole, MembershipStatus, Prisma, RecordStatus, Role } from '@prisma/client';
import { redactUser } from '../common/security';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserAccessInput } from './users.schemas';

/**
 * Platform identity administration only. Scoped access is managed exclusively
 * by /tenants/:tenantId/memberships and /workspaces/:workspaceId/members.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccess(actor: Principal) {
    this.requireSuper(actor);
    const users = await this.prisma.user.findMany({
      select: {
        id: true, tenantId: true, email: true, name: true, role: true, status: true,
        lastLoginAt: true, createdAt: true, updatedAt: true,
        clientMemberships: {
          select: {
            tenantId: true, role: true, status: true,
            tenant: { select: { id: true, name: true, slug: true, status: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => ({ ...user, membershipCount: user.clientMemberships.length }));
  }

  async updateAccess(id: string, input: UpdateUserAccessInput, actor: Principal) {
    this.requireSuper(actor);
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, tenantId: true, role: true, status: true, name: true, email: true },
    });
    if (!existing) throw new NotFoundException('Usuário não encontrado.');
    if (actor.id === id && (input.role !== undefined || input.status !== undefined)) {
      throw new ForbiddenException('Você não pode alterar o acesso global da própria conta.');
    }

    const nextStatus = input.status === 'ARCHIVED' ? RecordStatus.REMOVED : (input.status ?? existing.status) as RecordStatus;
    let nextRole = (input.role ?? existing.role) as Role;
    let nextTenantId = input.tenantId !== undefined ? input.tenantId : existing.tenantId;
    if (nextRole === Role.SUPER_ADMIN) {
      nextTenantId = null;
    } else {
      if (!nextTenantId) throw new ConflictException('Selecione um cliente para o contexto padrão.');
      const membership = await this.prisma.clientMembership.findUnique({
        where: { tenantId_userId: { tenantId: nextTenantId, userId: id } },
      });
      if (!membership || membership.status !== MembershipStatus.ACTIVE) {
        throw new ConflictException('Crie ou ative o vínculo do usuário com o cliente antes de alterar seu contexto padrão.');
      }
      nextRole = membership.role === ClientRole.CLIENT_ADMIN ? Role.CLIENT_ADMIN : Role.PROJECT_USER;
    }

    const deactivatesSuper = existing.role === Role.SUPER_ADMIN && existing.status === RecordStatus.ACTIVE
      && (nextRole !== Role.SUPER_ADMIN || nextStatus !== RecordStatus.ACTIVE);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('personaia:global-super-admins', 0))`;
      if (deactivatesSuper) {
        const activeSupers = await tx.user.count({ where: { role: Role.SUPER_ADMIN, status: RecordStatus.ACTIVE } });
        if (activeSupers <= 1) throw new ConflictException('Mantenha pelo menos um superadministrador ativo.');
      }
      const accessChanged = nextRole !== existing.role || nextStatus !== existing.status || nextTenantId !== existing.tenantId;
      const updated = await tx.user.update({
        where: { id },
        data: {
          role: nextRole, status: nextStatus, tenantId: nextTenantId,
          ...(accessChanged ? { tokenVersion: { increment: 1 } } : {}),
        },
      });
      if (accessChanged) {
        await tx.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId: nextTenantId, action: 'GLOBAL_USER_ACCESS_UPDATED', targetType: 'User', targetId: id,
          scopeType: 'PLATFORM', metadata: {
            previous: { role: existing.role, status: existing.status, tenantId: existing.tenantId },
            next: { role: nextRole, status: nextStatus, tenantId: nextTenantId },
          },
        },
      });
      return redactUser(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private requireSuper(actor: Principal) {
    if (actor.role !== Role.SUPER_ADMIN) throw new ForbiddenException('Acesso não permitido.');
  }
}
