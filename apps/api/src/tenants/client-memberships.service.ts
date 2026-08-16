import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientRole, MembershipStatus, Prisma, RecordStatus, Role, WorkspaceRole,
} from '@prisma/client';
import { AccessControlService } from '../common/access-control.service';
import { Principal } from '../common/types/principal';
import { normalizeEmail } from '../common/security';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddClientMembershipInput, UpdateClientMembershipInput } from './tenants.schemas';

@Injectable()
export class ClientMembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(tenantId: string, actor: Principal) {
    await this.access.requireTenant(actor, tenantId);
    const tenantAdmin = this.access.isSuper(actor) || (await this.prisma.clientMembership.count({
      where: { tenantId, userId: actor.id, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
    })) > 0;
    if (!tenantAdmin) {
      const workspaceAdmin = await this.prisma.workspaceMembership.count({
        where: {
          tenantId, userId: actor.id, role: WorkspaceRole.WORKSPACE_ADMIN, status: MembershipStatus.ACTIVE,
          clientMembership: { status: MembershipStatus.ACTIVE }, workspace: { status: RecordStatus.ACTIVE },
        },
      });
      if (!workspaceAdmin) throw new NotFoundException('Organização não encontrada.');
    }
    return this.prisma.clientMembership.findMany({
      where: { tenantId, ...(tenantAdmin ? {} : { status: MembershipStatus.ACTIVE }) },
      select: {
        id: true, tenantId: true, userId: true, role: true, status: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, name: true, email: true, status: true, lastLoginAt: true } },
        requestedProject: { select: { id: true, name: true, status: true } },
        _count: { select: { workspaceMemberships: { where: { status: MembershipStatus.ACTIVE } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(tenantId: string, input: AddClientMembershipInput, actor: Principal) {
    await this.access.requireTenant(actor, tenantId, true);
    const user = input.userId
      ? await this.prisma.user.findUnique({ where: { id: input.userId } })
      : await this.prisma.user.findUnique({ where: { email: normalizeEmail(input.email!) } });
    if (!user || user.status === RecordStatus.REMOVED) throw new NotFoundException('Usuário não encontrado.');
    return this.serializable(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      const activeTenant = await tx.tenant.count({ where: { id: tenantId, status: RecordStatus.ACTIVE } });
      if (!activeTenant) throw new NotFoundException('Organização não encontrada.');
      const membership = await tx.clientMembership.upsert({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        update: { role: input.role, status: input.status },
        create: { tenantId, userId: user.id, role: input.role, status: input.status },
      });
      if (input.status === MembershipStatus.ACTIVE) await this.activateIdentity(tx, user.id, tenantId, input.role);
      if (input.role === ClientRole.CLIENT_ADMIN && input.status === MembershipStatus.ACTIVE) {
        await this.ensureWorkspaceAdminEverywhere(tx, tenantId, user.id);
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId, action: 'CLIENT_MEMBERSHIP_ADDED', targetType: 'ClientMembership', targetId: membership.id,
          scopeType: 'TENANT', scopeId: tenantId, metadata: { userId: user.id, role: input.role, status: input.status },
        },
      });
      return membership;
    });
  }

  async update(tenantId: string, userId: string, input: UpdateClientMembershipInput, actor: Principal) {
    await this.access.requireTenant(actor, tenantId, true);
    const existing = await this.prisma.clientMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!existing || existing.status === MembershipStatus.REMOVED) throw new NotFoundException('Vínculo não encontrado.');
    const removesAdmin = existing.role === ClientRole.CLIENT_ADMIN && existing.status === MembershipStatus.ACTIVE
      && (input.role === ClientRole.CLIENT_MEMBER || (input.status && input.status !== MembershipStatus.ACTIVE));
    const nextRole = input.role ?? existing.role;
    const nextStatus = input.status ?? existing.status;
    const selectedProjectId = input.projectId !== undefined ? input.projectId : existing.requestedProjectId;
    if (input.projectId) {
      const selectedProject = await this.prisma.project.findFirst({
        where: { id: input.projectId, tenantId, status: RecordStatus.ACTIVE },
        select: { id: true },
      });
      if (!selectedProject) throw new NotFoundException('Projeto não encontrado.');
    }
    return this.serializable(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      if (removesAdmin) {
        const activeAdmins = await tx.clientMembership.count({
          where: { tenantId, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
        });
        if (activeAdmins <= 1) throw new ConflictException('Mantenha pelo menos um administrador ativo na organização.');
      }
      const membership = await tx.clientMembership.update({
        where: { id: existing.id },
        data: {
          ...(input.role ? { role: input.role } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.projectId !== undefined ? { requestedProjectId: input.projectId } : {}),
        },
      });
      if (nextStatus === MembershipStatus.ACTIVE) {
        await this.activateIdentity(tx, userId, tenantId, nextRole);
        if (selectedProjectId) {
          const requestedProject = await tx.project.findFirst({
            where: { id: selectedProjectId, tenantId, status: RecordStatus.ACTIVE },
            select: { id: true },
          });
          if (!requestedProject && input.projectId) throw new NotFoundException('Projeto não encontrado.');
          if (requestedProject) {
            await tx.projectMembership.upsert({
              where: { projectId_userId: { projectId: requestedProject.id, userId } },
              update: {},
              create: { tenantId, projectId: requestedProject.id, userId, permission: 'VIEWER' },
            });
            await tx.clientMembership.update({
              where: { id: existing.id },
              data: { requestedProjectId: null },
            });
            await this.notifications.resolveMissingProjectAccess(tx, userId, tenantId);
          }
        }
      } else if (existing.status === MembershipStatus.ACTIVE) {
        await tx.workspaceMembership.updateMany({
          where: { tenantId, userId, inheritedFromClientAdmin: true, status: MembershipStatus.ACTIVE },
          data: { status: nextStatus === MembershipStatus.REMOVED ? MembershipStatus.REMOVED : MembershipStatus.SUSPENDED },
        });
      }
      if (existing.role === ClientRole.CLIENT_ADMIN && nextRole === ClientRole.CLIENT_MEMBER) {
        await tx.workspaceMembership.updateMany({
          where: { tenantId, userId, inheritedFromClientAdmin: true },
          data: { role: WorkspaceRole.WORKSPACE_MEMBER, inheritedFromClientAdmin: false },
        });
      }
      if (nextRole === ClientRole.CLIENT_ADMIN && nextStatus === MembershipStatus.ACTIVE) {
        await this.ensureWorkspaceAdminEverywhere(tx, tenantId, userId);
      }
      const resolved = existing.status === MembershipStatus.PENDING_APPROVAL
        && (nextStatus === MembershipStatus.ACTIVE || nextStatus === MembershipStatus.REMOVED);
      if (resolved) {
        await this.notifications.resolveAccessRequest(tx, userId, tenantId);
        await this.notifications.resolveAccessRequest(tx, userId, null);
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id, tenantId,
          action: resolved ? nextStatus === MembershipStatus.ACTIVE ? 'USER_ACCESS_APPROVED' : 'USER_ACCESS_REJECTED' : 'CLIENT_MEMBERSHIP_UPDATED',
          targetType: 'ClientMembership', targetId: membership.id, scopeType: 'TENANT', scopeId: tenantId,
          metadata: {
            userId,
            previous: { role: existing.role, status: existing.status, requestedProjectId: existing.requestedProjectId },
            next: { role: nextRole, status: nextStatus, requestedProjectId: nextStatus === MembershipStatus.ACTIVE ? null : selectedProjectId },
          },
        },
      });
      return membership;
    });
  }

  remove(tenantId: string, userId: string, actor: Principal) {
    return this.update(tenantId, userId, { status: MembershipStatus.REMOVED }, actor);
  }

  private async activateIdentity(tx: Prisma.TransactionClient, userId: string, tenantId: string, role: ClientRole) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status === RecordStatus.ACTIVE) return;
    if (!new Set<RecordStatus>([RecordStatus.PENDING, RecordStatus.PENDING_APPROVAL, RecordStatus.INVITED]).has(user.status)) {
      throw new ConflictException('A identidade global está inativa e exige reativação explícita pelo superadministrador.');
    }
    await tx.user.update({
      where: { id: userId },
      data: {
        status: RecordStatus.ACTIVE,
        ...(user.role !== Role.SUPER_ADMIN && !user.tenantId ? {
          tenantId,
          role: role === ClientRole.CLIENT_ADMIN ? Role.CLIENT_ADMIN : Role.PROJECT_USER,
        } : {}),
      },
    });
  }

  private async ensureWorkspaceAdminEverywhere(tx: Prisma.TransactionClient, tenantId: string, userId: string) {
    const workspaces = await tx.workspace.findMany({ where: { tenantId, status: RecordStatus.ACTIVE }, select: { id: true } });
    for (const workspace of workspaces) {
      const existing = await tx.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
      });
      if (!existing) {
        await tx.workspaceMembership.create({ data: {
          tenantId, workspaceId: workspace.id, userId,
          role: WorkspaceRole.WORKSPACE_ADMIN, status: MembershipStatus.ACTIVE,
          inheritedFromClientAdmin: true,
        } });
      } else if (existing.role !== WorkspaceRole.WORKSPACE_ADMIN || existing.status !== MembershipStatus.ACTIVE) {
        await tx.workspaceMembership.update({
          where: { id: existing.id },
          data: { role: WorkspaceRole.WORKSPACE_ADMIN, status: MembershipStatus.ACTIVE, inheritedFromClientAdmin: true },
        });
      }
    }
  }

  private async serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('A operação conflitou com outra alteração. Recarregue os dados e tente novamente.');
      }
      throw error;
    }
  }
}
