import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientRole, MembershipStatus, Prisma, RecordStatus, Role } from '@prisma/client';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';

export const ACCESS_REQUESTED_NOTIFICATION = 'ACCESS_REQUESTED';
export const USER_LOGIN_WITHOUT_PROJECT_NOTIFICATION = 'USER_LOGIN_WITHOUT_PROJECT';

type AccessRequestContext = {
  userId: string;
  userName: string;
  userEmail: string;
  tenantId: string;
  tenantName: string;
  requestedProjectId?: string;
  requestedProjectName?: string;
};

type MissingProjectContext = Omit<AccessRequestContext, 'requestedProjectId' | 'requestedProjectName'>;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async dispatchAccessRequest(tx: Prisma.TransactionClient, request: AccessRequestContext) {
    const recipientIds = await this.adminRecipientIds(tx, request.tenantId);
    if (recipientIds.length === 0) return;

    await tx.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        recipientId,
        tenantId: request.tenantId,
        type: ACCESS_REQUESTED_NOTIFICATION,
        targetId: request.userId,
        payload: {
          userName: request.userName,
          userEmail: request.userEmail,
          tenantName: request.tenantName,
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
      tx.user.findMany({
        where: { status: RecordStatus.ACTIVE, role: Role.SUPER_ADMIN },
        select: { id: true },
      }),
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
    return [...new Set([...superAdmins.map(({ id }) => id), ...clientAdmins.map(({ userId }) => userId)])];
  }

  async resolveAccessRequest(tx: Prisma.TransactionClient, targetId: string, tenantId: string) {
    const now = new Date();
    await tx.notification.updateMany({
      where: { type: ACCESS_REQUESTED_NOTIFICATION, targetId, tenantId, resolvedAt: null },
      data: { resolvedAt: now, readAt: now },
    });
  }

  async list(actor: Principal) {
    const authorized = await this.authorizedWhere(actor);
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: authorized,
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
        take: 30,
      }),
      this.prisma.notification.count({ where: { ...authorized, readAt: null } }),
    ]);
    return { items, unreadCount };
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
