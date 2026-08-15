import { z } from 'zod';
import { passwordSchema } from '../auth/auth.schemas';

const name = z.string().trim().min(2).max(120);
const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const createTenantSchema = z.object({
  name,
  slug,
  admin: z.object({ name, email: z.string().email().max(254), password: passwordSchema }).strict()
}).strict();

export const createClientAdminSchema = z.object({
  tenantId: z.string().uuid(),
  name,
  email: z.string().email().max(254),
  password: passwordSchema
}).strict();

export const clientAdminQuerySchema = z.object({ tenantId: z.string().uuid().optional() }).strict();

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type CreateClientAdminInput = z.infer<typeof createClientAdminSchema>;
export type ClientAdminQuery = z.infer<typeof clientAdminQuerySchema>;
