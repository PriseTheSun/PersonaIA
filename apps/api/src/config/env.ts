import { z } from 'zod';

const durationPattern = /^\d+(s|m|h|d)$/;

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(3).max(100).default('personaia-api'),
  JWT_AUDIENCE: z.string().min(3).max(100).default('personaia-web'),
  JWT_ACCESS_TTL: z.string().regex(durationPattern).default('15m'),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(1_440).default(120),
  CORS_ORIGINS: z.string().min(1),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  RATE_LIMIT_TTL_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(100),
  INVITATION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168)
});

export type Environment = z.infer<typeof environmentSchema>;

const knownSecretFragments = ['replace', 'change-me', 'changethis', 'password', 'example', 'development', 'default-secret', 'test-secret'];

function hasAdequateSecretEntropy(secret: string) {
  const frequencies = new Map<string, number>();
  for (const character of secret) frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
  const entropyPerCharacter = [...frequencies.values()].reduce((entropy, count) => {
    const probability = count / secret.length;
    return entropy - probability * Math.log2(probability);
  }, 0);
  return frequencies.size >= 12 && entropyPerCharacter >= 3.5;
}

function isUnsafeProductionSecret(secret: string) {
  const normalized = secret.toLowerCase();
  return knownSecretFragments.some((fragment) => normalized.includes(fragment)) || !hasAdequateSecretEntropy(secret);
}

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const parsed = environmentSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
    throw new Error('JWT access and refresh secrets must be different');
  }
  const corsOrigins = parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!corsOrigins.length || corsOrigins.includes('*') || corsOrigins.some((origin) => {
    try { return !['http:', 'https:'].includes(new URL(origin).protocol); } catch { return true; }
  })) {
    throw new Error('CORS_ORIGINS must contain explicit, comma-separated HTTP(S) origins; wildcards are forbidden');
  }
  if (parsed.data.NODE_ENV === 'production' && corsOrigins.some((origin) => !origin.startsWith('https://'))) {
    throw new Error('CORS_ORIGINS must use HTTPS in production');
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.COOKIE_SECURE !== 'true') {
    throw new Error('COOKIE_SECURE must be true in production');
  }
  if (parsed.data.NODE_ENV === 'production' && [parsed.data.JWT_ACCESS_SECRET, parsed.data.JWT_REFRESH_SECRET].some(isUnsafeProductionSecret)) {
    throw new Error('JWT secrets must be randomly generated, high-entropy values without placeholder text in production');
  }
  return parsed.data;
}
