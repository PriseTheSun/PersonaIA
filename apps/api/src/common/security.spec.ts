import { hashToken, normalizeEmail, normalizeSlug } from './security';

describe('security helpers', () => {
  it('normalizes identifiers deterministically', () => {
    expect(normalizeEmail(' Admin@Example.COM ')).toBe('admin@example.com');
    expect(normalizeSlug(' Pesquisa Brasil 2026 ')).toBe('pesquisa-brasil-2026');
  });

  it('never stores a refresh token in plaintext', () => {
    const raw = 'refresh.jwt.value';
    expect(hashToken(raw)).not.toContain(raw);
    expect(hashToken(raw)).toMatch(/^[a-f0-9]{64}$/);
  });
});
