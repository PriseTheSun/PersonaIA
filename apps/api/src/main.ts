import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser = require('cookie-parser');
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const production = config.get<string>('NODE_ENV') === 'production';
  if (config.get<string>('TRUST_PROXY') === 'true') app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: production ? undefined : false,
    hsts: production ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'no-referrer' }
  }));
  app.use(json({ limit: '1mb', strict: true }));
  app.use(urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const origins = config.getOrThrow<string>('CORS_ORIGINS').split(',').map((item) => item.trim()).filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-CSRF-Token', 'X-Tenant-Id', 'X-Workspace-Id'],
  });

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
