import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(actor: Principal) {
    if (actor.role === 'SUPER_ADMIN') {
      const [tenants, clientAdmins, projects, users, recent] = await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.user.count({ where: { role: Role.CLIENT_ADMIN } }),
        this.prisma.project.count(),
        this.prisma.user.count({ where: { role: Role.PROJECT_USER } }),
        this.recentActivity()
      ]);
      return { tenants, clientAdmins, projects, users, recentActivity: recent };
    }
    if (actor.role === Role.PROJECT_USER) {
      const projects = await this.prisma.projectMembership.count({
        where: { userId: actor.id, tenantId: actor.tenantId! }
      });
      return { tenants: 0, clientAdmins: 0, projects, users: 0, recentActivity: [] };
    }
    const tenantId = actor.tenantId!;
    const [projects, users, memberships, recent] = await Promise.all([
      this.prisma.project.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId, role: Role.PROJECT_USER } }),
      this.prisma.projectMembership.count({ where: { tenantId } }),
      this.recentActivity(tenantId)
    ]);
    return { tenants: 1, clientAdmins: 0, projects, users, memberships, recentActivity: recent };
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
