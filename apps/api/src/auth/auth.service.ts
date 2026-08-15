import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, RecordStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { hashToken, normalizeEmail, redactUser } from '../common/security';
import { LoginInput, RegisterInput } from './auth.schemas';

interface SessionContext { userAgent?: string; ipAddress?: string }
interface RefreshPayload { sub: string; sid: string; fid: string; type: 'refresh'; ver: number; rem?: boolean }

@Injectable()
export class AuthService {
  private readonly dummyHash = argon2.hash('Dummy-password-value-1!', { type: argon2.argon2id });

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(input: RegisterInput) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: input.tenantSlug, status: RecordStatus.ACTIVE },
      select: { id: true, name: true }
    });
    if (!tenant) throw new BadRequestException({ code: 'INVALID_TENANT', message: 'Código da organização inválido.' });

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1
    });
    const userName = input.name.trim();
    const userEmail = normalizeEmail(input.email);
    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: userName,
            email: userEmail,
            passwordHash,
            role: Role.PROJECT_USER,
            status: RecordStatus.PENDING
          }
        });
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: 'USER_REGISTERED',
            targetType: 'User',
            targetId: user.id,
            metadata: { source: 'SELF_REGISTRATION' }
          }
        });
        await this.notifications.dispatchAccessRequest(tx, {
          userId: user.id,
          userName,
          userEmail,
          tenantId: tenant.id,
          tenantName: tenant.name,
        });
      });
    } catch (error) {
      // A resposta idempotente impede enumeração pública de e-mails existentes.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
    return { status: 'PENDING' as const };
  }

  async login(input: LoginInput, context: SessionContext) {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(input.email) }, include: { tenant: true } });
    const hash = user?.passwordHash ?? await this.dummyHash;
    const matches = await argon2.verify(hash, input.password).catch(() => false);
    if (!user || !matches) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    if (user.status === RecordStatus.PENDING) {
      throw new ForbiddenException({ code: 'ACCOUNT_PENDING', message: 'Cadastro aguardando aprovação.' });
    }
    if (user.status !== RecordStatus.ACTIVE || (user.tenant && user.tenant.status !== RecordStatus.ACTIVE)) {
      throw new ForbiddenException({ code: 'ACCOUNT_INACTIVE', message: 'Conta inativa.' });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueSession(user, context, input.rememberMe === true);
    return { ...tokens, user: redactUser(user) };
  }

  async refresh(rawToken: string, context: SessionContext) {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(rawToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), algorithms: ['HS256'],
        issuer: this.config.getOrThrow('JWT_ISSUER'), audience: this.config.getOrThrow('JWT_AUDIENCE')
      });
      if (payload.type !== 'refresh' || !payload.sid || !payload.fid) throw new Error('wrong token');
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: { include: { tenant: true } } }
    });
    if (!session || session.id !== payload.sid || session.familyId !== payload.fid || session.userId !== payload.sub) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    const user = session.user;
    if (session.revokedAt || session.expiresAt <= new Date() || user.tokenVersion !== payload.ver) {
      await this.revokeFamily(session.familyId, user.id);
      throw new UnauthorizedException('Reutilização de sessão detectada. Faça login novamente.');
    }
    if (user.status !== RecordStatus.ACTIVE || (user.tenant && user.tenant.status !== RecordStatus.ACTIVE)) {
      await this.revokeFamily(session.familyId, user.id);
      throw new UnauthorizedException('Conta inativa.');
    }

    const nextId = randomUUID();
    const rememberMe = payload.rem === true;
    const refreshToken = await this.signRefresh(user.id, nextId, session.familyId, user.tokenVersion, rememberMe);
    const expiresAt = this.refreshExpiry();
    const rotated = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: nextId }
      });
      if (consumed.count !== 1) return false;
      await tx.refreshSession.create({
        data: {
          id: nextId, userId: user.id, familyId: session.familyId, tokenHash: hashToken(refreshToken), expiresAt,
          userAgent: context.userAgent?.slice(0, 300), ipAddress: context.ipAddress?.slice(0, 64)
        }
      });
      return true;
    });
    if (!rotated) {
      await this.revokeFamily(session.familyId, user.id);
      throw new UnauthorizedException('Reutilização de sessão detectada. Faça login novamente.');
    }
    return { accessToken: await this.signAccess(user), refreshToken, expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_TTL'), rememberMe };
  }

  async logout(rawToken?: string) {
    if (!rawToken) return;
    await this.prisma.refreshSession.updateMany({ where: { tokenHash: hashToken(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issueSession(user: { id: string; tokenVersion: number; tenantId: string | null; role: string }, context: SessionContext, rememberMe: boolean) {
    const id = randomUUID();
    const familyId = randomUUID();
    const refreshToken = await this.signRefresh(user.id, id, familyId, user.tokenVersion, rememberMe);
    await this.prisma.refreshSession.create({
      data: {
        id, familyId, userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: this.refreshExpiry(),
        userAgent: context.userAgent?.slice(0, 300), ipAddress: context.ipAddress?.slice(0, 64)
      }
    });
    return { accessToken: await this.signAccess(user), refreshToken, expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_TTL'), rememberMe };
  }

  private signAccess(user: { id: string; tokenVersion: number; tenantId: string | null; role: string }) {
    return this.jwt.signAsync(
      { sub: user.id, type: 'access', ver: user.tokenVersion, tid: user.tenantId, role: user.role },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), algorithm: 'HS256', expiresIn: this.config.getOrThrow('JWT_ACCESS_TTL') as never,
        issuer: this.config.getOrThrow('JWT_ISSUER'), audience: this.config.getOrThrow('JWT_AUDIENCE')
      }
    );
  }

  private signRefresh(userId: string, sessionId: string, familyId: string, version: number, rememberMe: boolean) {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, fid: familyId, type: 'refresh', ver: version, rem: rememberMe },
      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), algorithm: 'HS256', expiresIn: `${this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS')}d` as never,
        issuer: this.config.getOrThrow('JWT_ISSUER'), audience: this.config.getOrThrow('JWT_AUDIENCE')
      }
    );
  }

  private refreshExpiry() {
    return new Date(Date.now() + this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS') * 86_400_000);
  }

  private async revokeFamily(familyId: string, userId: string) {
    await this.prisma.$transaction([
      this.prisma.refreshSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } })
    ]);
  }
}
