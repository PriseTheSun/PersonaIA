import { z } from 'zod';
import { permissionSchema } from '@/lib/schemas';

const name = z.string().trim().min(2, 'forms.validation.name').max(120);
const email = z.string().trim().email('validation.email').max(254);
export const strongPassword = z.string()
  .min(12, 'forms.validation.password')
  .max(128, 'forms.validation.password')
  .regex(/[a-z]/, 'forms.validation.password')
  .regex(/[A-Z]/, 'forms.validation.password')
  .regex(/[0-9]/, 'forms.validation.password')
  .regex(/[^A-Za-z0-9]/, 'forms.validation.password');

export const createTenantFormSchema = z.object({
  name,
  slug: z.string().trim().min(2, 'forms.validation.slug').max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'forms.validation.slug'),
  adminName: name,
  adminEmail: email,
  adminPassword: strongPassword,
});
export type CreateTenantFormInput = z.infer<typeof createTenantFormSchema>;

export const createAdminFormSchema = z.object({ tenantId: z.string().uuid('forms.validation.tenant'), name, email, password: strongPassword });
export type CreateAdminFormInput = z.infer<typeof createAdminFormSchema>;

export const createProjectFormSchema = z.object({ name, description: z.string().trim().max(500).optional() });
export type CreateProjectFormInput = z.infer<typeof createProjectFormSchema>;

export const createUserFormSchema = z.object({ name, email, password: strongPassword, projectIds: z.array(z.string().uuid()).max(100), permission: permissionSchema });
export type CreateUserFormInput = z.infer<typeof createUserFormSchema>;

export const moveUserFormSchema = z.object({ fromProjectId: z.string().uuid(), toProjectId: z.string().uuid(), permission: permissionSchema }).refine((value) => value.fromProjectId !== value.toProjectId, { path: ['toProjectId'], message: 'forms.validation.differentProject' });
export type MoveUserFormInput = z.infer<typeof moveUserFormSchema>;
