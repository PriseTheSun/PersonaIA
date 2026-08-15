import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const tenantId = '10000000-0000-4000-8000-000000000001';
  const targetId = '20000000-0000-4000-8000-000000000002';

  it('notifies every active super admin and only the active client admins of the request tenant', async () => {
    const superAdmins = [
      { id: '30000000-0000-4000-8000-000000000003' },
    ];
    const clientAdmins = [
      { userId: '40000000-0000-4000-8000-000000000004' },
      { userId: '50000000-0000-4000-8000-000000000005' },
    ];
    const tx = {
      user: { findMany: jest.fn().mockResolvedValue(superAdmins) },
      clientMembership: { findMany: jest.fn().mockResolvedValue(clientAdmins) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 3 }) }
    };
    const service = new NotificationsService({} as never);

    await service.dispatchAccessRequest(tx as never, {
      userId: targetId,
      userName: 'Pessoa Teste',
      userEmail: 'pessoa@teste.dev',
      tenantId,
      tenantName: 'Cliente Teste'
    });

    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', role: 'SUPER_ADMIN' },
      select: { id: true }
    });
    expect(tx.clientMembership.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId, role: 'CLIENT_ADMIN', status: 'ACTIVE' }),
    }));
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [...superAdmins.map(({ id }) => id), ...clientAdmins.map(({ userId }) => userId)].map((recipientId) => ({
        recipientId,
        tenantId,
        type: 'ACCESS_REQUESTED',
        targetId,
        payload: {
          userName: 'Pessoa Teste',
          userEmail: 'pessoa@teste.dev',
          tenantName: 'Cliente Teste'
        }
      })),
      skipDuplicates: true
    });
  });

  it('always scopes lists and unread counts to the authenticated recipient', async () => {
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      }
    };
    const service = new NotificationsService(prisma as never);
    const actor = {
      id: '30000000-0000-4000-8000-000000000003', tenantId: null,
      email: 'admin@test.dev', name: 'Admin', role: 'SUPER_ADMIN' as const, tokenVersion: 0
    };

    await expect(service.list(actor)).resolves.toEqual({ items: [], unreadCount: 0 });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { recipientId: actor.id }
    }));
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { recipientId: actor.id, readAt: null }
    });
  });

  it('does not allow one recipient to mark another recipient notification as read', async () => {
    const prisma = { notification: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const service = new NotificationsService(prisma as never);
    const actor = {
      id: '30000000-0000-4000-8000-000000000003', tenantId: null,
      email: 'admin@test.dev', name: 'Admin', role: 'SUPER_ADMIN' as const, tokenVersion: 0
    };

    await expect(service.markRead('60000000-0000-4000-8000-000000000006', actor))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: '60000000-0000-4000-8000-000000000006', recipientId: actor.id },
      data: { readAt: expect.any(Date) }
    });
  });
});
