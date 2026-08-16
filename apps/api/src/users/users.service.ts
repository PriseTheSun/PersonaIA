import { ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ClientRole, MembershipStatus, Prisma, RecordStatus, Role } from '@prisma/client';
import { redactUser } from '../common/security';
import { Principal } from '../common/types/principal';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserAccessInput } from './users.schemas';

/**
 * Platform identity administration only. Scoped access is managed exclusively
 * by /tenants/:tenantId/memberships and /workspaces/:workspaceId/members.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

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
    } else if (!nextTenantId) throw new ConflictException('Selecione uma organização para o contexto padrão.');

    const deactivatesSuper = existing.role === Role.SUPER_ADMIN && existing.status === RecordStatus.ACTIVE
      && (nextRole !== Role.SUPER_ADMIN || nextStatus !== RecordStatus.ACTIVE);
    return this.serializable(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('personaia:global-super-admins', 0))`;
      if (deactivatesSuper) {
        const activeSupers = await tx.user.count({ where: { role: Role.SUPER_ADMIN, status: RecordStatus.ACTIVE } });
        if (activeSupers <= 1) throw new ConflictException('Mantenha pelo menos um superadministrador ativo.');
      }
      if (nextRole !== Role.SUPER_ADMIN && nextTenantId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${nextTenantId}, 0))`;
        const tenant = await tx.tenant.findFirst({ where: { id: nextTenantId, status: RecordStatus.ACTIVE }, select: { id: true } });
        if (!tenant) throw new NotFoundException('Organização não encontrada.');
        let membership = await tx.clientMembership.findUnique({
          where: { tenantId_userId: { tenantId: nextTenantId, userId: id } },
        });
        if (!membership || membership.status !== MembershipStatus.ACTIVE) {
          const approvable = new Set<RecordStatus>([
            RecordStatus.PENDING, RecordStatus.PENDING_APPROVAL, RecordStatus.INVITED,
          ]).has(existing.status) && nextStatus === RecordStatus.ACTIVE;
          if (!approvable) {
            throw new ConflictException('Crie ou ative o vínculo do usuário com a organização antes de alterar seu contexto padrão.');
          }
          membership = membership
            ? await tx.clientMembership.update({ where: { id: membership.id }, data: { status: MembershipStatus.ACTIVE } })
            : await tx.clientMembership.create({
                data: { tenantId: nextTenantId, userId: id, role: ClientRole.CLIENT_MEMBER, status: MembershipStatus.ACTIVE },
              });
          if (membership.requestedProjectId) {
            const requestedProject = await tx.project.findFirst({
              where: { id: membership.requestedProjectId, tenantId: nextTenantId, status: RecordStatus.ACTIVE },
              select: { id: true },
            });
            if (requestedProject) {
              await tx.projectMembership.upsert({
                where: { projectId_userId: { projectId: requestedProject.id, userId: id } },
                update: {},
                create: { tenantId: nextTenantId, projectId: requestedProject.id, userId: id, permission: 'VIEWER' },
              });
              await this.notifications?.resolveMissingProjectAccess(tx, id, nextTenantId);
            }
            await tx.clientMembership.update({ where: { id: membership.id }, data: { requestedProjectId: null } });
          }
          await this.notifications?.resolveAccessRequest(tx, id, nextTenantId);
        }
        nextRole = membership.role === ClientRole.CLIENT_ADMIN ? Role.CLIENT_ADMIN : Role.PROJECT_USER;
      }
      const resolvesGlobalRequest = existing.status === RecordStatus.PENDING_APPROVAL
        && (nextStatus === RecordStatus.ACTIVE || nextStatus === RecordStatus.REMOVED);
      if (resolvesGlobalRequest) await this.notifications?.resolveAccessRequest(tx, id, null);
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
    });
  }

  private requireSuper(actor: Principal) {
    if (actor.role !== Role.SUPER_ADMIN) throw new ForbiddenException('Acesso não permitido.');
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
