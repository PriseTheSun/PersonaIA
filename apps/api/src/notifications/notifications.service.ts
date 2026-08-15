import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus, Role } from '@prisma/client';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';

export const ACCESS_REQUESTED_NOTIFICATION = 'ACCESS_REQUESTED';

type AccessRequestContext = {
  userId: string;
  userName: string;
  userEmail: string;
  tenantId: string;
  tenantName: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async dispatchAccessRequest(tx: Prisma.TransactionClient, request: AccessRequestContext) {
    const recipients = await tx.user.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        OR: [
          { role: Role.SUPER_ADMIN },
          { role: Role.CLIENT_ADMIN, tenantId: request.tenantId },
        ],
      },
      select: { id: true },
    });
    if (recipients.length === 0) return;

    await tx.notification.createMany({
      data: recipients.map(({ id: recipientId }) => ({
        recipientId,
        tenantId: request.tenantId,
        type: ACCESS_REQUESTED_NOTIFICATION,
        targetId: request.userId,
        payload: {
          userName: request.userName,
          userEmail: request.userEmail,
          tenantName: request.tenantName,
        },
      })),
      skipDuplicates: true,
    });
  }

  async resolveAccessRequest(tx: Prisma.TransactionClient, targetId: string) {
    const now = new Date();
    await tx.notification.updateMany({
      where: { type: ACCESS_REQUESTED_NOTIFICATION, targetId, resolvedAt: null },
      data: { resolvedAt: now, readAt: now },
    });
  }

  async list(actor: Principal) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId: actor.id },
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
      this.prisma.notification.count({ where: { recipientId: actor.id, readAt: null } }),
    ]);
    return { items, unreadCount };
  }

  async markRead(id: string, actor: Principal) {
    const updated = await this.prisma.notification.updateMany({
      where: { id, recipientId: actor.id },
      data: { readAt: new Date() },
    });
    if (updated.count !== 1) throw new NotFoundException('Notificação não encontrada.');
    return { status: 'READ' as const };
  }

  async markAllRead(actor: Principal) {
    const updated = await this.prisma.notification.updateMany({
      where: { recipientId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: updated.count };
  }
}
