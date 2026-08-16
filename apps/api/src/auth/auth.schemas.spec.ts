import { passwordSchema } from './auth.schemas';

describe('passwordSchema', () => {
  it.each([
    ['fewer than 12 characters', 'Short!1Aa'],
    ['no uppercase letter', 'longpassword!1'],
    ['no lowercase letter', 'LONGPASSWORD!1'],
    ['no number', 'LongPassword!!'],
    ['no special character', 'LongPassword12'],
  ])('rejects a password with %s', (_scenario, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });

  it('accepts a password that meets every requirement, including localized letters', () => {
    expect(passwordSchema.safeParse('ÁrvoreSegura!2026').success).toBe(true);
  });
});
