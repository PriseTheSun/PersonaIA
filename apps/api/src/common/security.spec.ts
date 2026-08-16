import { hashToken, normalizeEmail, normalizeSlug, redactUser } from './security';

describe('security helpers', () => {
  it('normalizes identifiers deterministically', () => {
    expect(normalizeEmail(' Admin@Example.COM ')).toBe('admin@example.com');
    expect(normalizeSlug(' Pesquisa Brasil 2026 ')).toBe('pesquisa-brasil-2026');
    expect(normalizeSlug('Organização Árvore')).toBe('organizacao-arvore');
    expect(normalizeSlug('Organização -- Árvore')).toBe('organizacao-arvore');
  });

  it('never stores a refresh token in plaintext', () => {
    const raw = 'refresh.jwt.value';
    expect(hashToken(raw)).not.toContain(raw);
    expect(hashToken(raw)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('never exposes password hashes or avatar bytes in user responses', () => {
    const safe = redactUser({
      id: 'user-1',
      passwordHash: 'secret-hash',
      tokenVersion: 4,
      avatarData: Uint8Array.from([1, 2, 3]),
      avatarMimeType: 'image/png',
      avatarUpdatedAt: new Date('2026-08-15T12:00:00.000Z'),
    });
    expect(safe).not.toHaveProperty('passwordHash');
    expect(safe).not.toHaveProperty('tokenVersion');
    expect(safe).not.toHaveProperty('avatarData');
    expect(safe).not.toHaveProperty('avatarMimeType');
    expect(safe).toEqual(expect.objectContaining({ hasAvatar: true }));
  });
});
