import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClientRole, MembershipStatus, Prisma, RecordStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectAccessCodeService } from '../projects/project-access-code.service';
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
    private readonly projectCodes: ProjectAccessCodeService,
  ) {}

  async register(input: RegisterInput) {
    const requestedProject = input.projectCode
      ? await this.projectCodes.resolveProject(input.projectCode)
      : null;
    const tenant = requestedProject?.tenant ?? null;

    const userName = input.name.trim();
    const userEmail = normalizeEmail(input.email);
    const existingIdentity = await this.prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, passwordHash: true, status: true },
    });
    if (existingIdentity) {
      const ownsIdentity = await argon2.verify(existingIdentity.passwordHash, input.password).catch(() => false);
      if (!ownsIdentity) return { status: 'PENDING' as const };
      if (!new Set<RecordStatus>([
        RecordStatus.PENDING, RecordStatus.PENDING_APPROVAL, RecordStatus.INVITED, RecordStatus.ACTIVE,
      ]).has(existingIdentity.status)) return { status: 'PENDING' as const };
    }
    const passwordHash = existingIdentity?.passwordHash ?? await argon2.hash(input.password, {
      type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1
    });
    const persistRegistration = () => this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email: userEmail } });
      let registrationCreated = false;
      if (user) {
        const ownsIdentity = await argon2.verify(user.passwordHash, input.password).catch(() => false);
        if (!ownsIdentity) return;
        if (!new Set<RecordStatus>([
          RecordStatus.PENDING, RecordStatus.PENDING_APPROVAL, RecordStatus.INVITED, RecordStatus.ACTIVE,
        ]).has(user.status)) return;
      } else {
        user = await tx.user.create({
          data: {
            tenantId: tenant?.id ?? null,
            name: userName,
            email: userEmail,
            passwordHash,
            role: Role.PROJECT_USER,
            status: RecordStatus.PENDING_APPROVAL,
          },
        });
        registrationCreated = true;
      }
      if (tenant) {
        const existingMembership = await tx.clientMembership.findUnique({
          where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
        });
        if (!existingMembership) {
          await tx.clientMembership.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              requestedProjectId: requestedProject?.id,
              role: ClientRole.CLIENT_MEMBER,
              status: MembershipStatus.PENDING_APPROVAL,
            },
          });
          registrationCreated = true;
        } else if (existingMembership.status === MembershipStatus.REMOVED) {
          await tx.clientMembership.update({
            where: { id: existingMembership.id },
            data: { status: MembershipStatus.PENDING_APPROVAL, requestedProjectId: requestedProject?.id ?? null },
          });
          registrationCreated = true;
        } else if (
          existingMembership.status === MembershipStatus.PENDING_APPROVAL
          && requestedProject
          && existingMembership.requestedProjectId !== requestedProject.id
        ) {
          await tx.clientMembership.update({
            where: { id: existingMembership.id },
            data: { requestedProjectId: requestedProject.id },
          });
          registrationCreated = true;
        }
      }
      if (!registrationCreated) return;
      await tx.auditLog.create({
        data: {
          tenantId: tenant?.id ?? null,
          actorId: user.id,
          action: 'USER_REGISTERED',
          targetType: 'User',
          targetId: user.id,
          scopeType: tenant ? 'TENANT' : 'PLATFORM',
          scopeId: tenant?.id ?? null,
          metadata: {
            source: 'SELF_REGISTRATION',
            requestedProjectId: requestedProject?.id ?? null,
          }
        }
      });
      await this.notifications.dispatchAccessRequest(tx, {
        userId: user.id,
        userName,
        userEmail,
        ...(tenant ? { tenantId: tenant.id, tenantName: tenant.name } : {}),
        ...(requestedProject ? {
          requestedProjectId: requestedProject.id,
          requestedProjectName: requestedProject.name,
        } : {}),
      });
    });
    try {
      await persistRegistration();
    } catch (error) {
      // A resposta idempotente impede enumeração pública de e-mails existentes.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      // A unique collision can mean another request created the same global
      // identity concurrently. Retry after PostgreSQL resolves that writer.
      try {
        await persistRegistration();
      } catch (retryError) {
        if (!(retryError instanceof Prisma.PrismaClientKnownRequestError && retryError.code === 'P2002')) throw retryError;
      }
    }
    return { status: 'PENDING' as const };
  }

  async login(input: LoginInput, context: SessionContext) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(input.email) },
      include: {
        clientMemberships: {
          where: { status: MembershipStatus.ACTIVE, tenant: { status: RecordStatus.ACTIVE } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const hash = user?.passwordHash ?? await this.dummyHash;
    const matches = await argon2.verify(hash, input.password).catch(() => false);
    if (!user || !matches) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    if (user.status === RecordStatus.PENDING || user.status === RecordStatus.PENDING_APPROVAL) {
      throw new ForbiddenException({ code: 'ACCOUNT_PENDING', message: 'Cadastro aguardando aprovação.' });
    }
    if (user.status !== RecordStatus.ACTIVE || (user.role !== Role.SUPER_ADMIN && user.clientMemberships.length === 0)) {
      throw new ForbiddenException({ code: 'ACCOUNT_INACTIVE', message: 'Conta inativa.' });
    }
    const selectedMembership = user.clientMemberships.find((item) => item.tenantId === user.tenantId) ?? user.clientMemberships[0];
    const compatibilityRole = user.role === Role.SUPER_ADMIN
      ? Role.SUPER_ADMIN
      : selectedMembership?.role === ClientRole.CLIENT_ADMIN ? Role.CLIENT_ADMIN : Role.PROJECT_USER;
    const selectedTenantId = user.role === Role.SUPER_ADMIN ? null : selectedMembership?.tenantId ?? null;
    const currentUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), tenantId: selectedTenantId, role: compatibilityRole },
    });
    if (selectedMembership && selectedMembership.role !== ClientRole.CLIENT_ADMIN) {
      const hasProjectAccess = await this.hasProjectAccess(user.id, selectedMembership.tenantId);
      if (!hasProjectAccess) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: selectedMembership.tenantId },
          select: { name: true },
        });
        if (tenant) await this.notifications.dispatchMissingProjectAccess({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          tenantId: selectedMembership.tenantId,
          tenantName: tenant.name,
        });
      }
    }
    const tokens = await this.issueSession(currentUser, context, input.rememberMe === true);
    return { ...tokens, user: redactUser(currentUser) };
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
      include: {
        user: {
          include: {
            clientMemberships: { where: { status: MembershipStatus.ACTIVE, tenant: { status: RecordStatus.ACTIVE } } },
          },
        },
      }
    });
    if (!session || session.id !== payload.sid || session.familyId !== payload.fid || session.userId !== payload.sub) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    const user = session.user;
    if (session.revokedAt || user.tokenVersion !== payload.ver) {
      await this.revokeFamily(session.familyId, user.id);
      throw new UnauthorizedException('Reutilização de sessão detectada. Faça login novamente.');
    }
    const sessionExpiresAt = this.cappedSessionExpiry(session.createdAt, session.expiresAt);
    if (sessionExpiresAt <= new Date()) {
      await this.revokeFamily(session.familyId, user.id);
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    if (user.status !== RecordStatus.ACTIVE || (user.role !== Role.SUPER_ADMIN && user.clientMemberships.length === 0)) {
      await this.revokeFamily(session.familyId, user.id);
      throw new UnauthorizedException('Conta inativa.');
    }

    const nextId = randomUUID();
    const rememberMe = payload.rem === true;
    const refreshToken = await this.signRefresh(user.id, nextId, session.familyId, user.tokenVersion, rememberMe, sessionExpiresAt);
    const rotated = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: nextId }
      });
      if (consumed.count !== 1) return false;
      await tx.refreshSession.create({
        data: {
          id: nextId, userId: user.id, familyId: session.familyId, tokenHash: hashToken(refreshToken), expiresAt: sessionExpiresAt,
          userAgent: context.userAgent?.slice(0, 300), ipAddress: context.ipAddress?.slice(0, 64)
        }
      });
      return true;
    });
    if (!rotated) {
      await this.revokeFamily(session.familyId, user.id);
      throw new UnauthorizedException('Reutilização de sessão detectada. Faça login novamente.');
    }
    return {
      accessToken: await this.signAccess(user, sessionExpiresAt),
      refreshToken,
      expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_TTL'),
      sessionExpiresAt: sessionExpiresAt.toISOString(),
      rememberMe,
    };
  }

  async logout(rawToken?: string) {
    if (!rawToken) return;
    await this.prisma.refreshSession.updateMany({ where: { tokenHash: hashToken(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issueSession(user: { id: string; tokenVersion: number; tenantId: string | null; role: string }, context: SessionContext, rememberMe: boolean) {
    const id = randomUUID();
    const familyId = randomUUID();
    const sessionExpiresAt = this.sessionExpiry();
    const refreshToken = await this.signRefresh(user.id, id, familyId, user.tokenVersion, rememberMe, sessionExpiresAt);
    await this.prisma.refreshSession.create({
      data: {
        id, familyId, userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: sessionExpiresAt,
        userAgent: context.userAgent?.slice(0, 300), ipAddress: context.ipAddress?.slice(0, 64)
      }
    });
    return {
      accessToken: await this.signAccess(user, sessionExpiresAt),
      refreshToken,
      expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_TTL'),
      sessionExpiresAt: sessionExpiresAt.toISOString(),
      rememberMe,
    };
  }

  private signAccess(user: { id: string; tokenVersion: number; tenantId: string | null; role: string }, sessionExpiresAt: Date) {
    return this.jwt.signAsync(
      { sub: user.id, type: 'access', ver: user.tokenVersion, tid: user.tenantId, role: user.role, sessionExpiresAt: sessionExpiresAt.toISOString() },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), algorithm: 'HS256', expiresIn: this.accessTokenLifetimeSeconds(sessionExpiresAt),
        issuer: this.config.getOrThrow('JWT_ISSUER'), audience: this.config.getOrThrow('JWT_AUDIENCE')
      }
    );
  }

  private signRefresh(userId: string, sessionId: string, familyId: string, version: number, rememberMe: boolean, sessionExpiresAt: Date) {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, fid: familyId, type: 'refresh', ver: version, rem: rememberMe },
      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), algorithm: 'HS256', expiresIn: this.remainingSessionSeconds(sessionExpiresAt),
        issuer: this.config.getOrThrow('JWT_ISSUER'), audience: this.config.getOrThrow('JWT_AUDIENCE')
      }
    );
  }

  private sessionExpiry() {
    return new Date(Date.now() + this.sessionTtlMs());
  }

  private cappedSessionExpiry(createdAt: Date, storedExpiresAt: Date) {
    const configuredExpiry = new Date(createdAt.getTime() + this.sessionTtlMs());
    return configuredExpiry < storedExpiresAt ? configuredExpiry : storedExpiresAt;
  }

  private sessionTtlMs() {
    return this.config.getOrThrow<number>('SESSION_TTL_MINUTES') * 60_000;
  }

  private remainingSessionSeconds(sessionExpiresAt: Date) {
    return Math.max(1, Math.ceil((sessionExpiresAt.getTime() - Date.now()) / 1_000));
  }

  private accessTokenLifetimeSeconds(sessionExpiresAt: Date) {
    const accessTtl = this.durationSeconds(this.config.getOrThrow<string>('JWT_ACCESS_TTL'));
    return Math.min(accessTtl, this.remainingSessionSeconds(sessionExpiresAt));
  }

  private durationSeconds(duration: string) {
    const match = /^(\d+)(s|m|h|d)$/.exec(duration);
    if (!match) throw new Error('JWT_ACCESS_TTL inválido.');
    const value = Number(match[1]);
    const multipliers = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;
    return value * multipliers[match[2] as keyof typeof multipliers];
  }

  private async revokeFamily(familyId: string, userId: string) {
    await this.prisma.$transaction([
      this.prisma.refreshSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } })
    ]);
  }

  private async hasProjectAccess(userId: string, tenantId: string) {
    const [directMemberships, projectPermissions, workspaceProjects] = await Promise.all([
      this.prisma.projectMembership.count({
        where: {
          tenantId, userId,
          project: { status: RecordStatus.ACTIVE },
          clientMembership: { status: MembershipStatus.ACTIVE },
        },
      }),
      this.prisma.projectFunctionalPermission.count({
        where: {
          tenantId, userId, effect: 'ALLOW',
          project: { status: RecordStatus.ACTIVE },
          membership: { status: MembershipStatus.ACTIVE },
        },
      }),
      this.prisma.project.count({
        where: {
          tenantId,
          status: RecordStatus.ACTIVE,
          workspace: {
            status: RecordStatus.ACTIVE,
            memberships: {
              some: {
                userId,
                status: MembershipStatus.ACTIVE,
                clientMembership: { status: MembershipStatus.ACTIVE },
              },
            },
          },
        },
      }),
    ]);
    return directMemberships > 0 || projectPermissions > 0 || workspaceProjects > 0;
  }
}
