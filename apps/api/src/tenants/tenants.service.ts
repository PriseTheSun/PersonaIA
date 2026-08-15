import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientRole, MembershipStatus, Prisma, RecordStatus, Role, WorkspaceRole,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail, normalizeSlug, redactUser } from '../common/security';
import { Principal } from '../common/types/principal';
import {
  ClientAdminQuery, CreateClientAdminInput, CreateTenantInput, UpdateTenantInput,
} from './tenants.schemas';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { not: RecordStatus.REMOVED } },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            clientMemberships: { where: { role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE } },
            workspaces: { where: { status: RecordStatus.ACTIVE } },
            projects: { where: { status: RecordStatus.ACTIVE } },
          },
        },
      },
    });
    return tenants.map(({ _count, ...tenant }) => ({
      ...tenant,
      adminCount: _count.clientMemberships,
      workspaceCount: _count.workspaces,
      projectCount: _count.projects,
    }));
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: { select: { clientMemberships: true, workspaces: true, projects: true, personas: true, questionnaires: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Cliente não encontrado.');
    return tenant;
  }

  async createTenant(input: CreateTenantInput, actor: Principal) {
    const email = normalizeEmail(input.admin.email);
    const existingIdentity = await this.prisma.user.findUnique({ where: { email } });
    if (existingIdentity && !new Set<RecordStatus>([RecordStatus.ACTIVE, RecordStatus.PENDING, RecordStatus.PENDING_APPROVAL, RecordStatus.INVITED]).has(existingIdentity.status)) {
      throw new ConflictException('A identidade selecionada está inativa e exige reativação explícita.');
    }
    const passwordHash = existingIdentity?.passwordHash ?? await this.hashPassword(input.admin.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: input.name.trim(),
            slug: normalizeSlug(input.slug),
            segment: input.segment?.trim(),
            description: input.description?.trim(),
          },
        });
        const workspaceName = input.workspace?.name ?? 'Workspace principal';
        const workspace = await tx.workspace.create({
          data: {
            tenantId: tenant.id,
            name: workspaceName.trim(),
            slug: normalizeSlug(workspaceName),
            description: input.workspace?.description?.trim(),
            isDefault: true,
          },
        });
        const admin = existingIdentity ?? await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: input.admin.name.trim(),
            email,
            passwordHash,
            role: Role.CLIENT_ADMIN,
            status: RecordStatus.ACTIVE,
          },
        });
        if (existingIdentity && existingIdentity.status !== RecordStatus.ACTIVE) {
          await tx.user.update({ where: { id: admin.id }, data: { status: RecordStatus.ACTIVE } });
        }
        const membership = await tx.clientMembership.create({
          data: { tenantId: tenant.id, userId: admin.id, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
        });
        await tx.workspaceMembership.create({
          data: {
            tenantId: tenant.id, workspaceId: workspace.id, userId: admin.id,
            role: WorkspaceRole.WORKSPACE_ADMIN, status: MembershipStatus.ACTIVE,
            inheritedFromClientAdmin: true,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id, tenantId: tenant.id, action: 'TENANT_CREATED', targetType: 'Tenant', targetId: tenant.id,
            scopeType: 'TENANT', scopeId: tenant.id, metadata: { workspaceId: workspace.id, clientMembershipId: membership.id },
          },
        });
        return { tenant, workspace, admin: redactUser(admin) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.throwConflict(error);
    }
  }

  async updateTenant(tenantId: string, input: UpdateTenantInput, actor: Principal) {
    const existing = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) throw new NotFoundException('Cliente não encontrado.');
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.segment !== undefined ? { segment: input.segment?.trim() ?? null } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() ?? null } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: 'TENANT_UPDATED', targetType: 'Tenant', targetId: tenantId,
          scopeType: 'TENANT', scopeId: tenantId, metadata: { changed: Object.keys(input) },
        },
      });
      return tenant;
    });
  }

  async removeTenant(tenantId: string, actor: Principal) {
    const existing = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) throw new NotFoundException('Cliente não encontrado.');
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id: tenantId }, data: { status: RecordStatus.REMOVED } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: 'TENANT_REMOVED', targetType: 'Tenant', targetId: tenantId,
          scopeType: 'TENANT', scopeId: tenantId,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { success: true };
  }

  async listClientAdmins(query: ClientAdminQuery) {
    const memberships = await this.prisma.clientMembership.findMany({
      where: { role: ClientRole.CLIENT_ADMIN, ...(query.tenantId ? { tenantId: query.tenantId } : {}) },
      select: {
        tenantId: true, role: true, status: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, email: true, name: true, lastLoginAt: true, createdAt: true, updatedAt: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return memberships.map(({ user, ...membership }) => ({ ...user, ...membership, role: Role.CLIENT_ADMIN }));
  }

  async createClientAdmin(input: CreateClientAdminInput, actor: Principal) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: input.tenantId, status: RecordStatus.ACTIVE }, select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Organização não encontrada.');
    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && !new Set<RecordStatus>([RecordStatus.ACTIVE, RecordStatus.PENDING, RecordStatus.PENDING_APPROVAL, RecordStatus.INVITED]).has(existing.status)) {
      throw new ConflictException('A identidade selecionada está inativa e exige reativação explícita.');
    }
    const passwordHash = existing?.passwordHash ?? await this.hashPassword(input.password);
    try {
      const admin = await this.prisma.$transaction(async (tx) => {
        const user = existing ?? await tx.user.create({
          data: { tenantId: tenant.id, name: input.name.trim(), email, passwordHash, role: Role.CLIENT_ADMIN, status: RecordStatus.ACTIVE },
        });
        if (existing && existing.status !== RecordStatus.ACTIVE) {
          await tx.user.update({ where: { id: user.id }, data: { status: RecordStatus.ACTIVE } });
        }
        await tx.clientMembership.create({
          data: { tenantId: tenant.id, userId: user.id, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
        });
        const workspaces = await tx.workspace.findMany({
          where: { tenantId: tenant.id, status: RecordStatus.ACTIVE }, select: { id: true },
        });
        await tx.workspaceMembership.createMany({
          data: workspaces.map(({ id: workspaceId }) => ({
            tenantId: tenant.id, workspaceId, userId: user.id,
            role: WorkspaceRole.WORKSPACE_ADMIN, status: MembershipStatus.ACTIVE,
            inheritedFromClientAdmin: true,
          })),
          skipDuplicates: true,
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id, tenantId: tenant.id, action: 'CLIENT_ADMIN_CREATED', targetType: 'User', targetId: user.id,
            scopeType: 'TENANT', scopeId: tenant.id,
          },
        });
        return user;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
      throw new ConflictException('Slug, e-mail ou vínculo já cadastrado.');
    }
    throw error;
  }
}
