import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientRole, MembershipStatus, Prisma, RecordStatus, Role } from '@prisma/client';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsQuery } from './notifications.schemas';

export const ACCESS_REQUESTED_NOTIFICATION = 'ACCESS_REQUESTED';
export const USER_LOGIN_WITHOUT_PROJECT_NOTIFICATION = 'USER_LOGIN_WITHOUT_PROJECT';

type AccessRequestContext = {
  userId: string;
  userName: string;
  userEmail: string;
  tenantId?: string;
  tenantName?: string;
  requestedProjectId?: string;
  requestedProjectName?: string;
};

type MissingProjectContext = Omit<AccessRequestContext, 'requestedProjectId' | 'requestedProjectName' | 'tenantId' | 'tenantName'>
  & Required<Pick<AccessRequestContext, 'tenantId' | 'tenantName'>>;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async dispatchAccessRequest(tx: Prisma.TransactionClient, request: AccessRequestContext) {
    const recipientIds = request.tenantId
      ? await this.adminRecipientIds(tx, request.tenantId)
      : await this.superAdminRecipientIds(tx);
    if (recipientIds.length === 0) return;

    await tx.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        recipientId,
        tenantId: request.tenantId ?? null,
        type: ACCESS_REQUESTED_NOTIFICATION,
        targetId: request.userId,
        payload: {
          userName: request.userName,
          userEmail: request.userEmail,
          ...(request.tenantName ? { tenantName: request.tenantName } : {}),
          ...(request.requestedProjectId ? { requestedProjectId: request.requestedProjectId } : {}),
          ...(request.requestedProjectName ? { requestedProjectName: request.requestedProjectName } : {}),
        },
      })),
      skipDuplicates: true,
    });
  }

  async dispatchMissingProjectAccess(request: MissingProjectContext) {
    await this.prisma.$transaction(async (tx) => {
      const recipientIds = await this.adminRecipientIds(tx, request.tenantId);
      if (recipientIds.length === 0) return;
      await tx.notification.createMany({
        data: recipientIds.map((recipientId) => ({
          recipientId,
          tenantId: request.tenantId,
          type: USER_LOGIN_WITHOUT_PROJECT_NOTIFICATION,
          targetId: request.userId,
          payload: {
            userName: request.userName,
            userEmail: request.userEmail,
            tenantName: request.tenantName,
          },
        })),
        skipDuplicates: true,
      });
    });
  }

  async resolveMissingProjectAccess(tx: Prisma.TransactionClient, targetId: string, tenantId: string) {
    const now = new Date();
    await tx.notification.updateMany({
      where: { type: USER_LOGIN_WITHOUT_PROJECT_NOTIFICATION, targetId, tenantId, resolvedAt: null },
      data: { resolvedAt: now, readAt: now },
    });
  }

  private async adminRecipientIds(tx: Prisma.TransactionClient, tenantId: string) {
    const [superAdmins, clientAdmins] = await Promise.all([
      this.superAdminRecipientIds(tx),
      tx.clientMembership.findMany({
        where: {
          tenantId,
          role: ClientRole.CLIENT_ADMIN,
          status: MembershipStatus.ACTIVE,
          user: { status: RecordStatus.ACTIVE },
        },
        select: { userId: true },
      }),
    ]);
    return [...new Set([...superAdmins, ...clientAdmins.map(({ userId }) => userId)])];
  }

  private async superAdminRecipientIds(tx: Prisma.TransactionClient) {
    const superAdmins = await tx.user.findMany({
      where: { status: RecordStatus.ACTIVE, role: Role.SUPER_ADMIN },
      select: { id: true },
    });
    return superAdmins.map(({ id }) => id);
  }

  async resolveAccessRequest(tx: Prisma.TransactionClient, targetId: string, tenantId: string | null) {
    const now = new Date();
    await tx.notification.updateMany({
      where: { type: ACCESS_REQUESTED_NOTIFICATION, targetId, tenantId, resolvedAt: null },
      data: { resolvedAt: now, readAt: now },
    });
  }

  async list(actor: Principal, query: NotificationsQuery = { page: 1, pageSize: 25, status: 'ALL' }) {
    const authorized = await this.authorizedWhere(actor);
    const filtered: Prisma.NotificationWhereInput = {
      ...authorized,
      ...(query.status === 'UNREAD' ? { readAt: null } : query.status === 'READ' ? { readAt: { not: null } } : {}),
    };
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: filtered,
        select: {
          id: true,
          tenantId: true,
          type: true,
          targetId: true,
          payload: true,
          readAt: true,
          resolvedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where: filtered }),
      this.prisma.notification.count({ where: { ...authorized, readAt: null } }),
    ]);
    return {
      items,
      unreadCount,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async markRead(id: string, actor: Principal) {
    const authorized = await this.authorizedWhere(actor);
    const updated = await this.prisma.notification.updateMany({
      where: { ...authorized, id },
      data: { readAt: new Date() },
    });
    if (updated.count !== 1) throw new NotFoundException('Notificação não encontrada.');
    return { status: 'READ' as const };
  }

  async markAllRead(actor: Principal) {
    const authorized = await this.authorizedWhere(actor);
    const updated = await this.prisma.notification.updateMany({
      where: { ...authorized, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: updated.count };
  }

  private async authorizedWhere(actor: Principal): Promise<Prisma.NotificationWhereInput> {
    if (actor.role === Role.SUPER_ADMIN) return { recipientId: actor.id };
    const memberships = await this.prisma.clientMembership.findMany({
      where: {
        userId: actor.id, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE,
        tenant: { status: RecordStatus.ACTIVE },
      },
      select: { tenantId: true },
    });
    return {
      recipientId: actor.id,
      OR: [{ tenantId: null }, { tenantId: { in: memberships.map(({ tenantId }) => tenantId) } }],
    };
  }
}
