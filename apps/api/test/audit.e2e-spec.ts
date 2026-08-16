import { CanActivate, ExecutionContext, INestApplication, Injectable } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AuditController } from '../src/audit/audit.controller';
import { AuditService } from '../src/audit/audit.service';
import { RolesGuard } from '../src/common/guards/roles.guard';

@Injectable()
class TestPrincipalGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    request.user = {
      id: '10000000-0000-4000-8000-000000000001',
      tenantId: null,
      email: 'test@personaia.local',
      name: 'Test',
      role: request.headers['x-test-role'] ?? 'CLIENT_ADMIN',
      tokenVersion: 0,
    };
    return true;
  }
}

describe('Audit authorization (e2e)', () => {
  let app: INestApplication;
  const audit = { list: jest.fn().mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 }, filters: { actions: [], targetTypes: [], tenants: [] } }) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        { provide: AuditService, useValue: audit },
        { provide: APP_GUARD, useClass: TestPrincipalGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(() => app.close());

  it('denies CLIENT_ADMIN and allows SUPER_ADMIN', async () => {
    await request(app.getHttpServer()).get('/api/v1/audit-logs').set('X-Test-Role', 'CLIENT_ADMIN').expect(403);
    await request(app.getHttpServer()).get('/api/v1/audit-logs').set('X-Test-Role', 'SUPER_ADMIN').expect(200);
    expect(audit.list).toHaveBeenCalledTimes(1);
  });
});
