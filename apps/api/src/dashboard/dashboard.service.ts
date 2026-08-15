import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClientRole, Feature, MembershipStatus, PermissionLevel, Prisma, RecordStatus } from '@prisma/client';
import { AccessControlService } from '../common/access-control.service';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQuery, DashboardRange } from './dashboard.schemas';

type BucketUnit = 'day' | 'month' | 'year';
const rangeConfig: Record<DashboardRange, { buckets: number; unit: BucketUnit }> = {
  '7d': { buckets: 7, unit: 'day' }, '30d': { buckets: 30, unit: 'day' },
  '12m': { buckets: 12, unit: 'month' }, '5y': { buckets: 5, unit: 'year' },
};

function startOfBucket(value: Date, unit: BucketUnit) {
  if (unit === 'year') return new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  if (unit === 'month') return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
function addBuckets(value: Date, amount: number, unit: BucketUnit) {
  if (unit === 'year') return new Date(Date.UTC(value.getUTCFullYear() + amount, 0, 1));
  if (unit === 'month') return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1));
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + amount));
}
function buildSeries(range: DashboardRange, now: Date, projectDates: Date[], personaDates: Date[]) {
  const config = rangeConfig[range];
  const current = startOfBucket(now, config.unit);
  const from = addBuckets(current, -(config.buckets - 1), config.unit);
  const projects = new Map<string, number>();
  const personas = new Map<string, number>();
  for (const date of projectDates) {
    const key = startOfBucket(date, config.unit).toISOString(); projects.set(key, (projects.get(key) ?? 0) + 1);
  }
  for (const date of personaDates) {
    const key = startOfBucket(date, config.unit).toISOString(); personas.set(key, (personas.get(key) ?? 0) + 1);
  }
  return {
    bucket: config.unit, from,
    points: Array.from({ length: config.buckets }, (_, index) => {
      const periodStart = addBuckets(from, index, config.unit).toISOString();
      return { periodStart, projectsCreated: projects.get(periodStart) ?? 0, personasCreated: personas.get(periodStart) ?? 0 };
    }),
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService) {}

  async summary(actor: Principal, query: DashboardQuery) {
    const now = new Date();
    const range = query.range;
    const empty = buildSeries(range, now, [], []);
    if (!this.access.isSuper(actor) && !query.tenantId) {
      throw new ForbiddenException('Informe o contexto de cliente.');
    }

    const tenantId = query.tenantId;
    if (tenantId) await this.access.requireTenant(actor, tenantId);
    let workspaceIds: string[] | undefined;
    if (query.workspaceId) {
      const workspace = await this.access.requireFeature(actor, {
        workspaceId: query.workspaceId, feature: Feature.DASHBOARD, level: PermissionLevel.READ,
      });
      if (tenantId && workspace.tenantId !== tenantId) throw new ForbiddenException('Contexto de workspace inválido.');
      workspaceIds = [query.workspaceId];
    } else if (tenantId && !this.access.isSuper(actor) && !await this.isClientAdmin(actor.id, tenantId)) {
      const memberships = await this.prisma.workspaceMembership.findMany({
        where: {
          tenantId, userId: actor.id, status: MembershipStatus.ACTIVE,
          clientMembership: { status: MembershipStatus.ACTIVE }, workspace: { status: RecordStatus.ACTIVE },
        },
        select: { workspaceId: true },
      });
      workspaceIds = [];
      for (const membership of memberships) {
        try {
          await this.access.requireFeature(actor, {
            workspaceId: membership.workspaceId, feature: Feature.DASHBOARD, level: PermissionLevel.READ,
          });
          workspaceIds.push(membership.workspaceId);
        } catch { /* Omit workspaces with no dashboard access. */ }
      }
      if (!workspaceIds.length) throw new ForbiddenException('Permissão de dashboard insuficiente.');
    }

    const createdAt = { gte: empty.from, lte: now };
    const projectWhere: Prisma.ProjectWhereInput = {
      ...(tenantId ? { tenantId } : {}), ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}), createdAt,
    };
    const personaWhere: Prisma.PersonaWhereInput = {
      ...(tenantId ? { tenantId } : {}), createdAt,
      ...(workspaceIds ? { workspaces: { some: { workspaceId: { in: workspaceIds }, disassociatedAt: null } } } : {}),
    };
    const membershipWhere: Prisma.ClientMembershipWhereInput = {
      ...(tenantId ? { tenantId } : {}),
    };
    const auditWhere: Prisma.AuditLogWhereInput = {
      ...(tenantId ? { tenantId } : {}), ...(query.workspaceId ? { scopeId: query.workspaceId } : {}),
    };
    const clientAdmin = tenantId ? this.access.isSuper(actor) || await this.isClientAdmin(actor.id, tenantId) : this.access.isSuper(actor);
    const activeUsersPromise = query.workspaceId
      ? this.prisma.workspaceMembership.count({
          where: { workspaceId: query.workspaceId, status: MembershipStatus.ACTIVE, clientMembership: { status: MembershipStatus.ACTIVE } },
        })
      : tenantId
        ? this.prisma.clientMembership.count({ where: { ...membershipWhere, status: MembershipStatus.ACTIVE } })
        : this.prisma.user.count({ where: { status: RecordStatus.ACTIVE } });
    const pendingPromise = clientAdmin
      ? this.prisma.clientMembership.count({ where: { ...membershipWhere, status: MembershipStatus.PENDING_APPROVAL } })
      : Promise.resolve(0);
    const [projects, personas, activeUsers, pendingAccessRequests, recentActivity] = await Promise.all([
      this.prisma.project.findMany({ where: projectWhere, select: { createdAt: true } }),
      this.prisma.persona.findMany({ where: personaWhere, select: { createdAt: true } }),
      activeUsersPromise,
      pendingPromise,
      this.prisma.auditLog.findMany({
        where: auditWhere, select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
        orderBy: { createdAt: 'desc' }, take: 8,
      }),
    ]);
    const series = buildSeries(range, now, projects.map(({ createdAt: date }) => date), personas.map(({ createdAt: date }) => date));
    return {
      scope: query.workspaceId ? 'WORKSPACE' : tenantId ? 'TENANT' : 'PLATFORM',
      tenantId: tenantId ?? null, workspaceId: query.workspaceId ?? null,
      range, bucket: series.bucket, from: series.from.toISOString(), to: now.toISOString(),
      metrics: {
        projectsCreated: projects.length, personasCreated: personas.length,
        activeUsers, pendingAccessRequests, accessibleProjects: projects.length,
      },
      series: series.points,
      recentActivity: recentActivity.map(({ action, ...item }) => ({ ...item, action, label: action })),
    };
  }

  private async isClientAdmin(userId: string, tenantId: string) {
    return (await this.prisma.clientMembership.count({
      where: { userId, tenantId, role: ClientRole.CLIENT_ADMIN, status: MembershipStatus.ACTIVE },
    })) > 0;
  }
}
