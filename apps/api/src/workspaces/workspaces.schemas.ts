import { z } from 'zod';

const feature = z.enum(['PERSONA', 'RESEARCH', 'SIMULATION', 'DASHBOARD']);
const permission = z.object({
  feature,
  level: z.enum(['READ', 'WRITE', 'ADMIN']),
  effect: z.enum(['ALLOW', 'DENY']).default('ALLOW'),
}).strict();

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().max(1000).optional(),
}).strict();

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const addWorkspaceMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['WORKSPACE_ADMIN', 'WORKSPACE_MEMBER']).default('WORKSPACE_MEMBER'),
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']).default('ACTIVE'),
  permissions: z.array(permission).max(4).default([]),
}).strict().superRefine((value, context) => {
  const features = value.permissions.map((item) => item.feature);
  if (new Set(features).size !== features.length) context.addIssue({ code: 'custom', message: 'Cada funcionalidade deve aparecer apenas uma vez.' });
});

export const updateWorkspaceMemberSchema = z.object({
  role: z.enum(['WORKSPACE_ADMIN', 'WORKSPACE_MEMBER']).optional(),
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const replacePermissionsSchema = z.object({
  permissions: z.array(permission).max(4),
}).strict().superRefine((value, context) => {
  const features = value.permissions.map((item) => item.feature);
  if (new Set(features).size !== features.length) context.addIssue({ code: 'custom', message: 'Cada funcionalidade deve aparecer apenas uma vez.' });
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type UpdateWorkspaceMemberInput = z.infer<typeof updateWorkspaceMemberSchema>;
export type ReplacePermissionsInput = z.infer<typeof replacePermissionsSchema>;
