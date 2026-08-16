import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecordStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const CODE_TTL_MS = 10 * 60 * 1_000;
const CODE_LENGTH = 12;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PROJECT_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{12}$/;

export type ProjectAccessCode = {
  code: string;
  expiresAt: string;
};

@Injectable()
export class ProjectAccessCodeService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  current(projectId: string, now = new Date()): ProjectAccessCode {
    const bucket = Math.floor(now.getTime() / CODE_TTL_MS);
    const expiresAt = new Date((bucket + 1) * CODE_TTL_MS);
    return { code: this.codeFor(projectId, bucket), expiresAt: expiresAt.toISOString() };
  }

  async resolveProject(tenantId: string, rawCode: string, now = new Date()) {
    const code = rawCode.trim().toUpperCase();
    if (!PROJECT_CODE_PATTERN.test(code)) this.invalidCode();
    const projects = await this.prisma.project.findMany({
      where: { tenantId, status: RecordStatus.ACTIVE },
      select: { id: true, name: true },
    });
    const supplied = Buffer.from(code, 'ascii');
    const matches = projects.filter((project) => {
      const expected = Buffer.from(this.current(project.id, now).code, 'ascii');
      return expected.length === supplied.length && timingSafeEqual(expected, supplied);
    });
    if (matches.length !== 1) this.invalidCode();
    return matches[0]!;
  }

  private codeFor(projectId: string, bucket: number) {
    const digest = createHmac('sha256', this.config.getOrThrow<string>('JWT_REFRESH_SECRET'))
      .update(`personaia:project-access-code:v1:${projectId}:${bucket}`)
      .digest();
    let bits = digest.readBigUInt64BE(0) >> 4n;
    let code = '';
    for (let index = 0; index < CODE_LENGTH; index += 1) {
      code = CODE_ALPHABET[Number(bits & 31n)] + code;
      bits >>= 5n;
    }
    return code;
  }

  private invalidCode(): never {
    throw new BadRequestException({
      code: 'INVALID_PROJECT_CODE',
      message: 'Código de projeto inválido ou expirado.',
    });
  }
}
