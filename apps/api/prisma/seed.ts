import { PrismaClient, RecordStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { passwordSchema } from '../src/auth/auth.schemas';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password || !passwordSchema.safeParse(password).success) {
    throw new Error('SUPER_ADMIN_EMAIL and a strong SUPER_ADMIN_PASSWORD are required (12+ characters, uppercase, lowercase, number and special character)');
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { email },
    update: { name: 'Super Admin', passwordHash, role: Role.SUPER_ADMIN, status: RecordStatus.ACTIVE, tenantId: null },
    create: { email, name: 'Super Admin', passwordHash, role: Role.SUPER_ADMIN, status: RecordStatus.ACTIVE }
  });
}

main().finally(async () => prisma.$disconnect());
