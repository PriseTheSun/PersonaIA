import { ClientRole, MembershipStatus, RecordStatus, Role } from '@prisma/client';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  const actor: Principal = {
    id: '00000000-0000-4000-8000-000000000001',
    tenantId: null,
    email: 'super@personaia.local',
    name: 'Super Admin',
    role: 'SUPER_ADMIN',
    tokenVersion: 0,
  };

  it('cria a organização sem workspace quando nenhuma pasta é informada', async () => {
    const tenant = { id: '00000000-0000-4000-8000-000000000010', name: 'Organização', slug: 'organizacao' };
    const admin = {
      id: '00000000-0000-4000-8000-000000000011',
      tenantId: tenant.id,
      name: 'Admin',
      email: 'admin@organizacao.test',
      passwordHash: 'hash-existente',
      role: Role.CLIENT_ADMIN,
      status: RecordStatus.ACTIVE,
      tokenVersion: 0,
      avatarUpdatedAt: null,
    };
    const tx = {
      tenant: { create: jest.fn().mockResolvedValue(tenant) },
      workspace: { create: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue(admin), create: jest.fn(), update: jest.fn() },
      clientMembership: {
        create: jest.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000012',
          tenantId: tenant.id,
          userId: admin.id,
          role: ClientRole.CLIENT_ADMIN,
          status: MembershipStatus.ACTIVE,
        }),
      },
      workspaceMembership: { create: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(admin) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    const result = await new TenantsService(prisma).createTenant({
      name: tenant.name,
      admin: { name: admin.name, email: admin.email, password: 'Senha-Forte-123!' },
    }, actor);

    expect(result.workspace).toBeNull();
    expect(tx.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ slug: tenant.slug }),
    });
    expect(tx.workspace.create).not.toHaveBeenCalled();
    expect(tx.workspaceMembership.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata: { clientMembershipId: expect.any(String) } }),
    });
  });
});
