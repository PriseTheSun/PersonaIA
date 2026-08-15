import { z } from 'zod';
import { clientRoleSchema, featureSchema, permissionEffectSchema, permissionSchema, accessLevelSchema, workspaceRoleSchema } from '@/lib/schemas';

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
  segment: z.string().trim().min(2, 'forms.validation.name').max(120),
  description: z.string().trim().max(500).optional(),
  adminName: name,
  adminEmail: email,
  adminPassword: strongPassword,
});
export type CreateTenantFormInput = z.infer<typeof createTenantFormSchema>;

export const createAdminFormSchema = z.object({ tenantId: z.string().uuid('forms.validation.tenant'), name, email, password: strongPassword });
export type CreateAdminFormInput = z.infer<typeof createAdminFormSchema>;

export const createWorkspaceFormSchema = z.object({ name, description: z.string().trim().max(500).optional() });
export type CreateWorkspaceFormInput = z.infer<typeof createWorkspaceFormSchema>;

export const createProjectFormSchema = z.object({ workspaceId: z.string().min(1, 'forms.validation.workspace'), name, description: z.string().trim().max(500).optional() });
export type CreateProjectFormInput = z.infer<typeof createProjectFormSchema>;

export const createClientMembershipFormSchema = z.object({
  userId: z.string().trim().min(1, 'forms.validation.user'),
  role: clientRoleSchema,
});
export type CreateClientMembershipFormInput = z.infer<typeof createClientMembershipFormSchema>;

export const createWorkspaceMembershipFormSchema = z.object({
  userId: z.string().trim().min(1, 'forms.validation.user'),
  role: workspaceRoleSchema,
});
export type CreateWorkspaceMembershipFormInput = z.infer<typeof createWorkspaceMembershipFormSchema>;

export const functionalPermissionInputSchema = z.object({ feature: featureSchema, level: accessLevelSchema, effect: permissionEffectSchema });

export const createAssetFormSchema = z.object({ name, description: z.string().trim().max(1000).optional() });
export type CreateAssetFormInput = z.infer<typeof createAssetFormSchema>;

export const createUserFormSchema = z.object({ name, email, password: strongPassword, projectIds: z.array(z.string().uuid()).max(100), permission: permissionSchema });
export type CreateUserFormInput = z.infer<typeof createUserFormSchema>;

export const moveUserFormSchema = z.object({ fromProjectId: z.string().uuid(), toProjectId: z.string().uuid(), permission: permissionSchema }).refine((value) => value.fromProjectId !== value.toProjectId, { path: ['toProjectId'], message: 'forms.validation.differentProject' });
export type MoveUserFormInput = z.infer<typeof moveUserFormSchema>;
