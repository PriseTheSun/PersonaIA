import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, RecordStatus, Role } from '@prisma/client';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardRange } from './dashboard.schemas';

type BucketUnit = 'day' | 'month' | 'year';

const rangeConfig: Record<DashboardRange, { buckets: number; unit: BucketUnit }> = {
  '7d': { buckets: 7, unit: 'day' },
  '30d': { buckets: 30, unit: 'day' },
  '12m': { buckets: 12, unit: 'month' },
  '5y': { buckets: 5, unit: 'year' },
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

function bucketKey(value: Date, unit: BucketUnit) {
  return startOfBucket(value, unit).toISOString();
}

function buildSeries(range: DashboardRange, now: Date, projectDates: Date[], personaDates: Date[]) {
  const config = rangeConfig[range];
  const currentBucket = startOfBucket(now, config.unit);
  const firstBucket = addBuckets(currentBucket, -(config.buckets - 1), config.unit);
  const projectsByBucket = new Map<string, number>();
  const personasByBucket = new Map<string, number>();

  for (const createdAt of projectDates) {
    const key = bucketKey(createdAt, config.unit);
    projectsByBucket.set(key, (projectsByBucket.get(key) ?? 0) + 1);
  }
  for (const createdAt of personaDates) {
    const key = bucketKey(createdAt, config.unit);
    personasByBucket.set(key, (personasByBucket.get(key) ?? 0) + 1);
  }

  return {
    bucket: config.unit,
    from: firstBucket,
    points: Array.from({ length: config.buckets }, (_, index) => {
      const periodStart = addBuckets(firstBucket, index, config.unit).toISOString();
      return {
        periodStart,
        projectsCreated: projectsByBucket.get(periodStart) ?? 0,
        personasCreated: personasByBucket.get(periodStart) ?? 0,
      };
    }),
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(actor: Principal, range: DashboardRange) {
    const now = new Date();
    const emptySeries = buildSeries(range, now, [], []);

    if (actor.role !== Role.SUPER_ADMIN && !actor.tenantId) {
      throw new ForbiddenException('Contexto de organização inválido.');
    }

    if (actor.role === Role.PROJECT_USER) {
      const accessibleProjects = await this.prisma.projectMembership.count({
        where: { userId: actor.id, tenantId: actor.tenantId! }
      });
      return {
        scope: Role.PROJECT_USER,
        range,
        bucket: emptySeries.bucket,
        from: emptySeries.from.toISOString(),
        to: now.toISOString(),
        metrics: {
          projectsCreated: 0,
          personasCreated: 0,
          activeUsers: 0,
          pendingAccessRequests: 0,
          accessibleProjects,
        },
        series: emptySeries.points,
        recentActivity: [],
      };
    }

    const tenantId = actor.role === Role.SUPER_ADMIN ? undefined : actor.tenantId ?? undefined;
    const createdAt = { gte: emptySeries.from, lte: now };
    const projectWhere: Prisma.ProjectWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      createdAt,
    };
    const userScope: Prisma.UserWhereInput = tenantId ? { tenantId } : {};
    const auditScope: Prisma.AuditLogWhereInput = tenantId ? { tenantId } : {};

    const [projects, personas, activeUsers, pendingAccessRequests, recentActivity] = await Promise.all([
      this.prisma.project.findMany({ where: projectWhere, select: { createdAt: true } }),
      this.prisma.auditLog.findMany({
        where: {
          ...auditScope,
          action: 'PERSONA_CREATED',
          targetType: 'Persona',
          createdAt,
        },
        select: { createdAt: true },
      }),
      this.prisma.user.count({ where: { ...userScope, status: RecordStatus.ACTIVE } }),
      this.prisma.user.count({ where: { ...userScope, status: RecordStatus.PENDING } }),
      this.recentActivity(tenantId),
    ]);
    const series = buildSeries(
      range,
      now,
      projects.map(({ createdAt: date }) => date),
      personas.map(({ createdAt: date }) => date),
    );

    return {
      scope: actor.role,
      range,
      bucket: series.bucket,
      from: series.from.toISOString(),
      to: now.toISOString(),
      metrics: {
        projectsCreated: projects.length,
        personasCreated: personas.length,
        activeUsers,
        pendingAccessRequests,
      },
      series: series.points,
      recentActivity,
    };
  }

  private async recentActivity(tenantId?: string) {
    const activity = await this.prisma.auditLog.findMany({
      where: tenantId ? { tenantId } : undefined,
      select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 8
    });
    return activity.map(({ action, ...item }) => ({ ...item, label: action }));
  }
}
