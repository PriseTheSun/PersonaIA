import { z } from 'zod';
import { passwordSchema } from '../auth/auth.schemas';

export const createProjectUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  password: passwordSchema,
  projectIds: z.array(z.string().uuid()).max(100).default([]),
  permission: z.enum(['OWNER', 'MANAGER', 'CONTRIBUTOR', 'VIEWER']).default('VIEWER')
}).strict();

export const updateProjectUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  password: passwordSchema.optional()
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const updateUserAccessSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  role: z.enum(['SUPER_ADMIN', 'CLIENT_ADMIN', 'PROJECT_USER']).optional(),
  tenantId: z.string().uuid().nullable().optional()
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export type CreateProjectUserInput = z.infer<typeof createProjectUserSchema>;
export type UpdateProjectUserInput = z.infer<typeof updateProjectUserSchema>;
export type UpdateUserAccessInput = z.infer<typeof updateUserAccessSchema>;
