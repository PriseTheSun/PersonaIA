import { BadRequestException } from '@nestjs/common';
import { ProjectAccessCodeService } from './project-access-code.service';

describe('ProjectAccessCodeService', () => {
  const projectId = '10000000-0000-4000-8000-000000000001';
  const tenantId = '20000000-0000-4000-8000-000000000002';
  const startedAt = new Date('2026-08-15T20:01:00.000Z');
  const config = { getOrThrow: jest.fn(() => 'refresh-secret-with-enough-entropy-for-tests') };

  it('keeps a 12-character code stable inside a window and rotates it after 10 minutes', () => {
    const service = new ProjectAccessCodeService({} as never, config as never);
    const first = service.current(projectId, startedAt);
    const sameWindow = service.current(projectId, new Date('2026-08-15T20:09:59.000Z'));
    const nextWindow = service.current(projectId, new Date('2026-08-15T20:10:00.000Z'));

    expect(first.code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
    expect(sameWindow.code).toBe(first.code);
    expect(nextWindow.code).not.toBe(first.code);
    expect(first.expiresAt).toBe('2026-08-15T20:10:00.000Z');
    expect(first.serverTime).toBe(startedAt.toISOString());
  });

  it('resolves the current code only among active projects in the selected organization', async () => {
    const project = { id: projectId, name: 'Pesquisa nacional', tenant: { id: tenantId, name: 'Organização Teste' } };
    const prisma = { project: { findMany: jest.fn().mockResolvedValue([project]) } };
    const service = new ProjectAccessCodeService(prisma as never, config as never);
    const code = service.current(projectId, startedAt).code;

    await expect(service.resolveProject(code.toLowerCase(), startedAt)).resolves.toEqual(project);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
      select: { id: true, name: true, tenant: { select: { id: true, name: true } } },
    });
    await expect(service.resolveProject('ABCDEFGHJKLM', startedAt)).rejects.toBeInstanceOf(BadRequestException);
  });
});
