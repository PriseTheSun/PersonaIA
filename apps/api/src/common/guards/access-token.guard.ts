import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { RecordStatus } from '@prisma/client';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Principal } from '../types/principal';
import { AuthenticatedRequest } from '../types/request';
import { PrismaService } from '../../prisma/prisma.service';

interface AccessPayload { sub: string; type: 'access'; ver: number; iat?: number; exp?: number }

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException('Token de acesso ausente.');
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(authorization.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        algorithms: ['HS256'],
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        audience: this.config.getOrThrow<string>('JWT_AUDIENCE')
      });
      if (payload.type !== 'access') throw new Error('wrong token type');
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, status: RecordStatus.ACTIVE },
        select: { id: true, tenantId: true, email: true, name: true, role: true, tokenVersion: true, tenant: { select: { status: true } } }
      });
      if (!user || user.tokenVersion !== payload.ver || (user.tenant && user.tenant.status !== RecordStatus.ACTIVE)) {
        throw new Error('invalid user state');
      }
      const principal: Principal = { id: user.id, tenantId: user.tenantId, email: user.email, name: user.name, role: user.role, tokenVersion: user.tokenVersion };
      (request as AuthenticatedRequest).user = principal;
      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }
  }
}
