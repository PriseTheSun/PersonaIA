import { z } from 'zod';

export const passwordSchema = z.string()
  .min(12, 'A senha deve ter pelo menos 12 caracteres.')
  .max(128, 'A senha deve ter no máximo 128 caracteres.')
  .regex(/[a-z]/, 'Inclua uma letra minúscula.')
  .regex(/[A-Z]/, 'Inclua uma letra maiúscula.')
  .regex(/[0-9]/, 'Inclua um número.')
  .regex(/[^A-Za-z0-9]/, 'Inclua um caractere especial.');

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128)
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
