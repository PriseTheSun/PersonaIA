import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail, normalizeSlug, redactUser } from '../common/security';
import { Principal } from '../common/types/principal';
import { ClientAdminQuery, CreateClientAdminInput, CreateTenantInput } from './tenants.schemas';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: { where: { role: Role.CLIENT_ADMIN } }, projects: true } } }
    });
    return tenants.map(({ _count, ...tenant }) => ({ ...tenant, adminCount: _count.users, projectCount: _count.projects }));
  }

  async createTenant(input: CreateTenantInput, actor: Principal) {
    const passwordHash = await this.hashPassword(input.admin.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({ data: { name: input.name.trim(), slug: normalizeSlug(input.slug) } });
        const admin = await tx.user.create({
          data: {
            tenantId: tenant.id, name: input.admin.name.trim(), email: normalizeEmail(input.admin.email), passwordHash,
            role: Role.CLIENT_ADMIN, status: RecordStatus.ACTIVE
          }
        });
        await tx.auditLog.create({ data: { actorId: actor.id, tenantId: tenant.id, action: 'TENANT_CREATED', targetType: 'Tenant', targetId: tenant.id } });
        return { tenant, admin: redactUser(admin) };
      });
    } catch (error) {
      this.throwConflict(error);
    }
  }

  listClientAdmins(query: ClientAdminQuery) {
    return this.prisma.user.findMany({
      where: { role: Role.CLIENT_ADMIN, ...(query.tenantId ? { tenantId: query.tenantId } : {}) },
      select: { id: true, tenantId: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true, updatedAt: true, tenant: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createClientAdmin(input: CreateClientAdminInput, actor: Principal) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id: input.tenantId, status: RecordStatus.ACTIVE }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Organização não encontrada.');
    try {
      const passwordHash = await this.hashPassword(input.password);
      const admin = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            tenantId: tenant.id, name: input.name.trim(), email: normalizeEmail(input.email), passwordHash,
            role: Role.CLIENT_ADMIN
          }
        });
        await tx.auditLog.create({ data: { actorId: actor.id, tenantId: tenant.id, action: 'CLIENT_ADMIN_CREATED', targetType: 'User', targetId: created.id } });
        return created;
      });
      return redactUser(admin);
    } catch (error) {
      this.throwConflict(error);
    }
  }

  private hashPassword(password: string) {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
  }

  private throwConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Slug ou e-mail já cadastrado.');
    }
    throw error;
  }
}
