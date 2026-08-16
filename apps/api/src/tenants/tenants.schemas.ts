import { z } from 'zod';
import { passwordSchema } from '../auth/auth.schemas';

const name = z.string().trim().min(2).max(120);
const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const createTenantSchema = z.object({
  name,
  slug: slug.optional(),
  segment: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  admin: z.object({ name, email: z.string().email().max(254), password: passwordSchema }).strict(),
  workspace: z.object({
    name: name.default('Workspace principal'),
    description: z.string().trim().max(1000).optional(),
  }).strict().optional(),
}).strict();

export const updateTenantSchema = z.object({
  name: name.optional(),
  segment: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const createClientAdminSchema = z.object({
  tenantId: z.string().uuid(),
  name,
  email: z.string().email().max(254),
  password: passwordSchema
}).strict();

export const clientAdminQuerySchema = z.object({ tenantId: z.string().uuid().optional() }).strict();

export const addClientMembershipSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().max(254).optional(),
  role: z.enum(['CLIENT_ADMIN', 'CLIENT_MEMBER']).default('CLIENT_MEMBER'),
  status: z.enum(['PENDING_APPROVAL', 'INVITED', 'ACTIVE', 'SUSPENDED']).default('INVITED'),
}).strict().refine((value) => Boolean(value.userId) !== Boolean(value.email), 'Informe userId ou email, mas não ambos.');

export const updateClientMembershipSchema = z.object({
  role: z.enum(['CLIENT_ADMIN', 'CLIENT_MEMBER']).optional(),
  status: z.enum(['PENDING_APPROVAL', 'INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
  projectId: z.string().uuid().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CreateClientAdminInput = z.infer<typeof createClientAdminSchema>;
export type ClientAdminQuery = z.infer<typeof clientAdminQuerySchema>;
export type AddClientMembershipInput = z.infer<typeof addClientMembershipSchema>;
export type UpdateClientMembershipInput = z.infer<typeof updateClientMembershipSchema>;
