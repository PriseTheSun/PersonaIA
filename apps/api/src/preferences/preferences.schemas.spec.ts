import { changePasswordSchema } from './preferences.schemas';

describe('changePasswordSchema', () => {
  it('accepts only a strong new password', () => {
    expect(changePasswordSchema.safeParse({ newPassword: 'NovaSenha#Segura2027' }).success).toBe(true);
  });

  it('rejects the obsolete current password field and weak new passwords', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'SenhaAtual#2026', newPassword: 'NovaSenha#Segura2027' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ newPassword: 'senha-fraca' }).success).toBe(false);
  });
});
