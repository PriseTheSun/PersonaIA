import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Rejects cross-site browser mutations before cookies or bearer tokens reach controllers. */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
    const source = request.get('origin') ?? request.get('referer');
    // Local CLI and test clients commonly omit Origin. Production never accepts that ambiguity.
    if (!source && this.config.get<string>('NODE_ENV') !== 'production') return true;
    if (!source) throw new ForbiddenException('Origem da requisição ausente.');
    let origin: string;
    try { origin = new URL(source).origin; } catch { throw new ForbiddenException('Origem da requisição inválida.'); }
    const allowed = this.config.getOrThrow<string>('CORS_ORIGINS').split(',').map((item) => item.trim()).filter(Boolean);
    if (!allowed.includes(origin)) throw new ForbiddenException('Origem da requisição não permitida.');
    return true;
  }
}
