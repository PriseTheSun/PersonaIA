import { createHash, randomBytes } from 'node:crypto';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const normalizeSlug = (slug: string) => slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newCsrfToken = () => randomBytes(32).toString('base64url');

export function redactUser<T extends {
  passwordHash?: string;
  tokenVersion?: number;
  avatarData?: Uint8Array | null;
  avatarMimeType?: string | null;
  avatarUpdatedAt?: Date | null;
}>(user: T) {
  const {
    passwordHash: _passwordHash,
    tokenVersion: _tokenVersion,
    avatarData: _avatarData,
    avatarMimeType: _avatarMimeType,
    avatarUpdatedAt,
    ...safe
  } = user;
  return { ...safe, avatarUpdatedAt, hasAvatar: Boolean(avatarUpdatedAt) };
}
