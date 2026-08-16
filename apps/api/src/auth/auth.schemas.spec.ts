import { passwordSchema, registerSchema } from './auth.schemas';

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

describe('registerSchema project code', () => {
  const registration = {
    name: 'Pessoa Teste', email: 'pessoa@teste.dev', password: 'ÁrvoreSegura!2026',
  };

  it('keeps the project code optional', () => {
    expect(registerSchema.safeParse(registration).success).toBe(true);
    expect(registerSchema.safeParse({ ...registration, tenantSlug: 'legacy-code' }).success).toBe(false);
  });

  it('accepts only the unambiguous 12-character project code alphabet', () => {
    expect(registerSchema.safeParse({ ...registration, projectCode: 'abcd2345efgh' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...registration, projectCode: 'ABCD1234EFGH' }).success).toBe(false);
  });
});
