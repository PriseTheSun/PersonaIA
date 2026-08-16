import { validateEnvironment } from './env';

const validProductionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://personaia:strong-password@postgres:5432/personaia?schema=public',
  JWT_ACCESS_SECRET: 'w7K!q9Z@p2L#v8N$x4R%t6Y&u1M*c3D?',
  JWT_REFRESH_SECRET: 'F5^n8B@r2X!s7Q%k4W&z9J#m6T*p3V$h',
  JWT_ISSUER: 'personaia-api',
  JWT_AUDIENCE: 'personaia-web',
  CORS_ORIGINS: 'https://app.personaia.example',
  COOKIE_SECURE: 'true'
};

describe('production environment security', () => {
  it('accepts distinct high-entropy secrets', () => {
    expect(validateEnvironment(validProductionEnvironment)).toMatchObject({ NODE_ENV: 'production', COOKIE_SECURE: 'true', SESSION_TTL_MINUTES: 120 });
  });

  it('accepts an explicit 120-minute session lifetime', () => {
    expect(validateEnvironment({ ...validProductionEnvironment, SESSION_TTL_MINUTES: '120' }).SESSION_TTL_MINUTES).toBe(120);
  });

  it('rejects known placeholder text even when it satisfies minimum length', () => {
    expect(() => validateEnvironment({
      ...validProductionEnvironment,
      JWT_ACCESS_SECRET: 'replace-with-at-least-32-random-characters'
    })).toThrow(/high-entropy/);
  });

  it('rejects long but low-entropy secrets', () => {
    expect(() => validateEnvironment({
      ...validProductionEnvironment,
      JWT_REFRESH_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab'
    })).toThrow(/high-entropy/);
  });
});
