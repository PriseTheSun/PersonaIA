import { ConflictException, NotFoundException } from '@nestjs/common';
import { hashToken } from '../common/security';
import { InvitationsService } from './invitations.service';

const tenantId = '10000000-0000-4000-8000-000000000001';
const invitationId = '20000000-0000-4000-8000-000000000002';
const projectId = '30000000-0000-4000-8000-000000000003';
const actor = {
  id: '40000000-0000-4000-8000-000000000004', tenantId: null,
  email: 'admin@personaia.test', name: 'Admin', role: 'SUPER_ADMIN' as const, tokenVersion: 0,
};

function setup(options: { delivered?: boolean; membership?: { id: string } | null; project?: { id: string; name: string } | null } = {}) {
  const created = {
    id: invitationId, tenantId, email: 'person@example.com', role: 'CLIENT_MEMBER',
    status: 'PENDING_DELIVERY', expiresAt: new Date('2026-08-23T12:00:00.000Z'),
    createdAt: new Date('2026-08-16T12:00:00.000Z'), project: options.project ?? null,
  };
  const tx = {
    invitation: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    },
    clientMembership: { findFirst: jest.fn().mockResolvedValue(options.membership ?? null) },
    project: { findFirst: jest.fn().mockResolvedValue(options.project ?? null) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    invitation: { update: jest.fn().mockResolvedValue({ ...created, status: 'SENT' }) },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const access = {
    requireTenant: jest.fn().mockResolvedValue({ id: tenantId, name: 'Research Org' }),
    lockTenant: jest.fn().mockResolvedValue(undefined),
  };
  const config = { getOrThrow: jest.fn().mockReturnValue(168) };
  const delivery = { deliver: jest.fn().mockResolvedValue(options.delivered ?? false) };
  const service = new InvitationsService(prisma as never, access as never, config as never, delivery);
  return { service, prisma, access, config, delivery, tx, created };
}

describe('InvitationsService', () => {
  it('creates a tenant-scoped pending invitation without exposing the raw token', async () => {
    const { service, delivery, tx } = setup();

    const result = await service.create(tenantId, { email: ' Person@Example.COM ', role: 'CLIENT_MEMBER' }, actor);

    expect(result).not.toHaveProperty('tokenHash');
    expect(tx.invitation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId,
        email: 'person@example.com',
        invitedById: actor.id,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }));
    const payload = delivery.deliver.mock.calls[0]?.[0];
    expect(payload).toEqual(expect.objectContaining({ recipient: 'person@example.com', tenantName: 'Research Org' }));
    expect(tx.invitation.create.mock.calls[0]?.[0].data.tokenHash).toBe(hashToken(payload.token));
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0])).not.toContain(payload.token);
  });

  it('marks the invitation as sent only after the delivery adapter confirms it', async () => {
    const { service, prisma } = setup({ delivered: true });

    const result = await service.create(tenantId, { email: 'person@example.com', role: 'CLIENT_MEMBER' }, actor);

    expect(prisma.invitation.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: invitationId },
      data: expect.objectContaining({ status: 'SENT', sentAt: expect.any(Date) }),
    }));
    expect(result.status).toBe('SENT');
  });

  it('rejects invitations for an existing organization membership', async () => {
    const { service, delivery } = setup({ membership: { id: '50000000-0000-4000-8000-000000000005' } });

    await expect(service.create(tenantId, { email: 'person@example.com', role: 'CLIENT_MEMBER' }, actor))
      .rejects.toBeInstanceOf(ConflictException);
    expect(delivery.deliver).not.toHaveBeenCalled();
  });

  it('rejects a project outside the selected organization without revealing it', async () => {
    const { service, delivery } = setup({ project: null });

    await expect(service.create(tenantId, { email: 'person@example.com', role: 'CLIENT_MEMBER', projectId }, actor))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(delivery.deliver).not.toHaveBeenCalled();
  });
});
