import { z } from 'zod';

export const passwordSchema = z.string()
  .min(12, 'A senha deve ter pelo menos 12 caracteres.')
  .max(128, 'A senha deve ter no máximo 128 caracteres.')
  .regex(/\p{Ll}/u, 'Inclua uma letra minúscula.')
  .regex(/\p{Lu}/u, 'Inclua uma letra maiúscula.')
  .regex(/\p{N}/u, 'Inclua um número.')
  .regex(/[^\p{L}\p{N}\s]/u, 'Inclua um caractere especial.');

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional().default(false)
}).strict();

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  password: passwordSchema,
  tenantSlug: z.string().trim().toLowerCase().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  projectCode: z.string().trim().toUpperCase().length(12).regex(/^[A-HJ-NP-Z2-9]{12}$/).optional(),
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
