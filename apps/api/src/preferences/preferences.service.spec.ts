import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PreferencesService } from './preferences.service';

describe('PreferencesService password security', () => {
  const actor = {
    id: '30000000-0000-4000-8000-000000000003', tenantId: null, email: 'admin@personaia.test', name: 'Admin',
    role: 'SUPER_ADMIN' as const, tokenVersion: 0,
  };

  async function setup(currentPassword = 'SenhaAtual#2026') {
    const passwordHash = await argon2.hash(currentPassword, { type: argon2.argon2id });
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: actor.id, passwordHash }),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
    return { service: new PreferencesService(prisma as never), tx };
  }

  it('rejects reusing the current password without mutating the account', async () => {
    const { service, tx } = await setup();
    await expect(service.changePassword({ newPassword: 'SenhaAtual#2026' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.refreshSession.updateMany).not.toHaveBeenCalled();
  });

  it('re-hashes the password, bumps tokenVersion, revokes sessions and audits the change', async () => {
    const { service, tx } = await setup();
    await expect(service.changePassword({ newPassword: 'NovaSenha#Segura2027' }, actor)).resolves.toEqual({ success: true, requiresLogin: true });
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: actor.id },
      data: expect.objectContaining({ passwordHash: expect.any(String), tokenVersion: { increment: 1 } }),
    }));
    expect(tx.refreshSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: actor.id, revokedAt: null } }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_PASSWORD_CHANGED' }) }));
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain('NovaSenha#Segura2027');
  });
});
