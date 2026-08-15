import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { CSRF_EXEMPT_KEY } from '../decorators/csrf-exempt.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Double-submit protection. XSRF-TOKEN is readable by the SPA; the refresh token is not. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
    if (this.reflector.getAllAndOverride<boolean>(CSRF_EXEMPT_KEY, [context.getHandler(), context.getClass()])) return true;
    const cookie = request.cookies?.['XSRF-TOKEN'] as string | undefined;
    const header = request.get('x-csrf-token');
    if (!cookie || !header) throw new ForbiddenException('Token CSRF ausente.');
    const cookieBytes = Buffer.from(cookie);
    const headerBytes = Buffer.from(header);
    if (cookieBytes.length !== headerBytes.length || !timingSafeEqual(cookieBytes, headerBytes)) {
      throw new ForbiddenException('Token CSRF inválido.');
    }
    return true;
  }
}
