import { z } from 'zod';

const permissionSchema = z.enum(['OWNER', 'MANAGER', 'CONTRIBUTOR', 'VIEWER']);

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().max(500).optional()
}).strict();

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional()
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const addMemberSchema = z.object({ userId: z.string().uuid(), permission: permissionSchema.default('VIEWER') }).strict();

export const updatePermissionSchema = z.union([
  z.object({ permission: permissionSchema }).strict(),
  z.object({ permissions: z.array(permissionSchema).min(1).max(4) }).strict().transform(({ permissions }) => {
    const order = ['VIEWER', 'CONTRIBUTOR', 'MANAGER', 'OWNER'] as const;
    return { permission: order.filter((item) => permissions.includes(item)).at(-1)! };
  })
]);

export const moveMemberSchema = z.object({
  userId: z.string().uuid(),
  toProjectId: z.string().uuid(),
  permission: permissionSchema.default('VIEWER')
}).strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdatePermissionInput = z.output<typeof updatePermissionSchema>;
export type MoveMemberInput = z.infer<typeof moveMemberSchema>;
