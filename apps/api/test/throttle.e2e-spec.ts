import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request = require('supertest');

@Controller('limited')
class LimitedController {
  @Get()
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  get() { return { ok: true }; }
}

describe('Rate limit (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }])],
      controllers: [LimitedController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('returns 429 after the endpoint limit', async () => {
    await request(app.getHttpServer()).get('/limited').expect(200);
    await request(app.getHttpServer()).get('/limited').expect(200);
    await request(app.getHttpServer()).get('/limited').expect(429);
  });
});
