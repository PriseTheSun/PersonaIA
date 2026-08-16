import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { Principal } from '../common/types/principal';
import { PrismaService } from '../prisma/prisma.service';
import { validateAvatarDataUrl } from './avatar-image';
import { ChangePasswordInput, UpdateAvatarInput } from './preferences.schemas';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(actor: Principal) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, name: true, email: true, avatarUpdatedAt: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return { ...user, hasAvatar: Boolean(user.avatarUpdatedAt) };
  }

  async avatar(actor: Principal) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { avatarData: true, avatarMimeType: true },
    });
    if (!user?.avatarData || !user.avatarMimeType) throw new NotFoundException('Foto de perfil não encontrada.');
    return { data: Buffer.from(user.avatarData), mimeType: user.avatarMimeType };
  }

  async updateAvatar(input: UpdateAvatarInput, actor: Principal) {
    const avatar = validateAvatarDataUrl(input.image);
    const avatarUpdatedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: { avatarData: Uint8Array.from(avatar.data), avatarMimeType: avatar.mimeType, avatarUpdatedAt },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'USER_AVATAR_UPDATED',
          targetType: 'User',
          targetId: actor.id,
          scopeType: 'USER',
          scopeId: actor.id,
          metadata: { mimeType: avatar.mimeType, width: avatar.width, height: avatar.height, bytes: avatar.data.length },
        },
      });
    });
    return { hasAvatar: true, avatarUpdatedAt };
  }

  async removeAvatar(actor: Principal) {
    const existing = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { avatarUpdatedAt: true } });
    if (!existing) throw new NotFoundException('Usuário não encontrado.');
    if (!existing.avatarUpdatedAt) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: { avatarData: null, avatarMimeType: null, avatarUpdatedAt: null },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'USER_AVATAR_REMOVED',
          targetType: 'User',
          targetId: actor.id,
          scopeType: 'USER',
          scopeId: actor.id,
        },
      });
    });
  }

  async changePassword(input: ChangePasswordInput, actor: Principal) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`personaia:user-preferences:${actor.id}`}, 0))`;
      const user = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true, passwordHash: true } });
      if (!user) throw new NotFoundException('Usuário não encontrado.');
      const repeatsPassword = await argon2.verify(user.passwordHash, input.newPassword).catch(() => false);
      if (repeatsPassword) {
        throw new BadRequestException({ code: 'PASSWORD_UNCHANGED', message: 'A nova senha deve ser diferente da senha atual.' });
      }
      const passwordHash = await argon2.hash(input.newPassword, {
        type: argon2.argon2id,
        memoryCost: 65_536,
        timeCost: 3,
        parallelism: 1,
      });
      await tx.user.update({
        where: { id: actor.id },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await tx.refreshSession.updateMany({
        where: { userId: actor.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'USER_PASSWORD_CHANGED',
          targetType: 'User',
          targetId: actor.id,
          scopeType: 'USER',
          scopeId: actor.id,
        },
      });
      return { success: true, requiresLogin: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
