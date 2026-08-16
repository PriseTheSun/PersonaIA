import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQuery } from './audit.schemas';

const sensitiveMetadataKey = /(authorization|cookie|credential|password|secret|session|token)/i;

function sanitizeMetadata(value: Prisma.JsonValue | undefined, depth = 0): unknown {
  if (depth >= 8) return '[TRUNCATED]';
  if (value === undefined) return null;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 2_000 ? `${value.slice(0, 2_000)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeMetadata(item, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    sensitiveMetadataKey.test(key) ? '[REDACTED]' : sanitizeMetadata(item, depth + 1),
  ]));
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditQuery, actor: Principal) {
    const where = this.buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const [items, total, actions, targetTypes, tenants] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          scopeType: true,
          scopeId: true,
          metadata: true,
          createdAt: true,
          actor: { select: { id: true, name: true, email: true } },
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
      this.prisma.auditLog.findMany({ distinct: ['targetType'], select: { targetType: true }, orderBy: { targetType: 'asc' } }),
      this.prisma.tenant.findMany({
        where: { auditLogs: { some: {} } },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'AUDIT_LOGS_VIEWED',
        targetType: 'AuditLog',
        scopeType: 'PLATFORM',
        metadata: {
          page: query.page,
          pageSize: query.pageSize,
          returned: items.length,
          filters: {
            search: Boolean(query.search),
            action: Boolean(query.action),
            targetType: Boolean(query.targetType),
            actorId: Boolean(query.actorId),
            tenantId: Boolean(query.tenantId),
            from: Boolean(query.from),
            to: Boolean(query.to),
          },
        },
      },
    });

    return {
      items: items.map((item) => ({
        ...item,
        metadata: item.metadata === null ? null : sanitizeMetadata(item.metadata),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      filters: {
        actions: actions.map(({ action }) => action),
        targetTypes: targetTypes.map(({ targetType }) => targetType),
        tenants,
      },
    };
  }

  private buildWhere(query: AuditQuery): Prisma.AuditLogWhereInput {
    const uuidSearch = query.search && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.search)
      ? query.search
      : undefined;
    return {
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.from || query.to ? {
        createdAt: {
          ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
          ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
        },
      } : {}),
      ...(query.search ? {
        OR: [
          { action: { contains: query.search, mode: 'insensitive' } },
          { targetType: { contains: query.search, mode: 'insensitive' } },
          { scopeType: { contains: query.search, mode: 'insensitive' } },
          { actor: { is: { OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ] } } },
          { tenant: { is: { OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { slug: { contains: query.search, mode: 'insensitive' } },
          ] } } },
          ...(uuidSearch ? [
            { id: uuidSearch },
            { targetId: uuidSearch },
            { scopeId: uuidSearch },
            { actorId: uuidSearch },
            { tenantId: uuidSearch },
          ] satisfies Prisma.AuditLogWhereInput[] : []),
        ],
      } : {}),
    };
  }
}
