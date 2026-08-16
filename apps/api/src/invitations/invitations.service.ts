import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitationStatus, MembershipStatus, Prisma, RecordStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AccessControlService } from '../common/access-control.service';
import { hashToken, normalizeEmail } from '../common/security';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import {
  INVITATION_EMAIL_DELIVERY,
  InvitationEmailDelivery,
} from './invitation-delivery';
import { CreateInvitationInput } from './invitations.schemas';

const ACTIVE_INVITATION_STATUSES = [InvitationStatus.PENDING_DELIVERY, InvitationStatus.SENT];

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly config: ConfigService,
    @Inject(INVITATION_EMAIL_DELIVERY) private readonly delivery: InvitationEmailDelivery,
  ) {}

  async create(tenantId: string, input: CreateInvitationInput, actor: Principal) {
    const tenant = await this.access.requireTenant(actor, tenantId, true);
    const email = normalizeEmail(input.email);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.getOrThrow<number>('INVITATION_TTL_HOURS') * 60 * 60 * 1_000);
    const token = randomBytes(32).toString('base64url');

    const invitation = await this.serializable(async (tx) => {
      await this.access.lockTenant(tx, tenantId);
      await tx.invitation.updateMany({
        where: { tenantId, email, status: { in: ACTIVE_INVITATION_STATUSES }, expiresAt: { lte: now } },
        data: { status: InvitationStatus.EXPIRED },
      });

      const existingMembership = await tx.clientMembership.findFirst({
        where: { tenantId, status: { not: MembershipStatus.REMOVED }, user: { email } },
        select: { id: true },
      });
      if (existingMembership) throw new ConflictException('Este e-mail já possui um vínculo com a organização.');

      const activeInvitation = await tx.invitation.findFirst({
        where: { tenantId, email, status: { in: ACTIVE_INVITATION_STATUSES }, expiresAt: { gt: now } },
        select: { id: true },
      });
      if (activeInvitation) throw new ConflictException('Já existe um convite ativo para este e-mail.');

      const project = input.projectId ? await tx.project.findFirst({
        where: { id: input.projectId, tenantId, status: RecordStatus.ACTIVE },
        select: { id: true, name: true },
      }) : null;
      if (input.projectId && !project) throw new NotFoundException('Projeto não encontrado.');

      const created = await tx.invitation.create({
        data: {
          tenantId,
          email,
          role: input.role,
          projectId: project?.id,
          invitedById: actor.id,
          tokenHash: hashToken(token),
          expiresAt,
        },
        select: {
          id: true, tenantId: true, email: true, role: true, status: true,
          expiresAt: true, createdAt: true,
          project: { select: { id: true, name: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          tenantId,
          action: 'EMAIL_INVITATION_CREATED',
          targetType: 'Invitation',
          targetId: created.id,
          scopeType: 'TENANT',
          scopeId: tenantId,
          metadata: { email, role: input.role, projectId: project?.id ?? null, expiresAt: expiresAt.toISOString() },
        },
      });
      return created;
    });

    let delivered = false;
    try {
      delivered = await this.delivery.deliver({
        recipient: email,
        tenantName: tenant.name,
        role: input.role,
        ...(invitation.project ? { projectName: invitation.project.name } : {}),
        token,
        expiresAt,
      });
    } catch {
      delivered = false;
    }

    if (!delivered) return invitation;
    return this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.SENT, sentAt: new Date() },
      select: {
        id: true, tenantId: true, email: true, role: true, status: true,
        expiresAt: true, createdAt: true,
        project: { select: { id: true, name: true } },
      },
    });
  }

  private async serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        throw new ConflictException('O convite conflitou com outra solicitação. Recarregue os dados e tente novamente.');
      }
      throw error;
    }
  }
}
