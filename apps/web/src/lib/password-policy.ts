import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;

export const passwordRequirementChecks = [
  { key: 'minLength', test: (password: string) => password.length >= PASSWORD_MIN_LENGTH },
  { key: 'uppercase', test: (password: string) => /\p{Lu}/u.test(password) },
  { key: 'lowercase', test: (password: string) => /\p{Ll}/u.test(password) },
  { key: 'number', test: (password: string) => /\p{N}/u.test(password) },
  { key: 'special', test: (password: string) => /[^\p{L}\p{N}\s]/u.test(password) },
] as const;

export const strongPassword = z.string()
  .min(PASSWORD_MIN_LENGTH, 'forms.validation.password')
  .max(128, 'forms.validation.password')
  .regex(/\p{Ll}/u, 'forms.validation.password')
  .regex(/\p{Lu}/u, 'forms.validation.password')
  .regex(/\p{N}/u, 'forms.validation.password')
  .regex(/[^\p{L}\p{N}\s]/u, 'forms.validation.password');
