import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OriginGuard } from './origin.guard';

describe('OriginGuard', () => {
  const config = { get: jest.fn((key) => key === 'NODE_ENV' ? 'production' : undefined), getOrThrow: jest.fn(() => 'https://app.personaia.test') } as unknown as ConfigService;
  const guard = new OriginGuard(config);
  const context = (origin?: string) => ({
    switchToHttp: () => ({ getRequest: () => ({ method: 'POST', get: (name: string) => name === 'origin' ? origin : undefined }) })
  }) as unknown as ExecutionContext;

  it('rejects a cross-site mutation', () => {
    expect(() => guard.canActivate(context('https://attacker.test'))).toThrow(ForbiddenException);
  });

  it('allows the configured application origin', () => {
    expect(guard.canActivate(context('https://app.personaia.test'))).toBe(true);
  });
});
