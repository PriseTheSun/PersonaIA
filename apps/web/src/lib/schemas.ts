import { z } from 'zod';

export const roleSchema = z.enum(['SUPER_ADMIN', 'CLIENT_ADMIN', 'PROJECT_USER']);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: roleSchema,
  tenantId: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'INVITED', 'SUSPENDED', 'ARCHIVED']).default('ACTIVE'),
  createdAt: z.string().datetime().optional(),
});
export type User = z.infer<typeof userSchema>;

export const tenantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(['ACTIVE', 'SUSPENDED']).default('ACTIVE'),
  adminCount: z.number().int().nonnegative().default(0),
  projectCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
});
export type Tenant = z.infer<typeof tenantSchema>;

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  memberCount: z.number().int().nonnegative().default(0),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const permissionSchema = z.enum(['VIEWER', 'CONTRIBUTOR', 'MANAGER', 'OWNER']);
export type Permission = z.infer<typeof permissionSchema>;

export const projectMemberSchema = z.object({
  user: userSchema,
  permissions: z.array(permissionSchema),
});
export type ProjectMember = z.infer<typeof projectMemberSchema>;

export const dashboardRangeSchema = z.enum(['7d', '30d', '12m', '5y']);
export type DashboardRange = z.infer<typeof dashboardRangeSchema>;

export const dashboardSummarySchema = z.object({
  scope: roleSchema,
  range: dashboardRangeSchema,
  bucket: z.enum(['day', 'month', 'year']),
  from: z.string().datetime(),
  to: z.string().datetime(),
  metrics: z.object({
    projectsCreated: z.number().int().nonnegative(),
    personasCreated: z.number().int().nonnegative(),
    activeUsers: z.number().int().nonnegative(),
    pendingAccessRequests: z.number().int().nonnegative(),
    accessibleProjects: z.number().int().nonnegative().optional(),
  }),
  series: z.array(z.object({
    periodStart: z.string().datetime(),
    projectsCreated: z.number().int().nonnegative(),
    personasCreated: z.number().int().nonnegative(),
  })),
  recentActivity: z.array(z.object({
    id: z.string(),
    label: z.string(),
    createdAt: z.string(),
  })).default([]),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const paginatedSchema = <T extends z.ZodTypeAny>(schema: T) => z.object({
  items: z.array(schema),
  total: z.number().int().nonnegative(),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'validation.required').email('validation.email'),
  password: z.string().min(1, 'validation.required').max(128),
  rememberMe: z.boolean(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'forms.validation.name').max(120),
  email: z.string().trim().email('validation.email').max(254),
  tenantSlug: z.string().trim().toLowerCase().min(2, 'forms.validation.slug').max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'forms.validation.slug'),
  password: z.string().min(12, 'forms.validation.password').max(128)
    .regex(/[a-z]/, 'forms.validation.password')
    .regex(/[A-Z]/, 'forms.validation.password')
    .regex(/[0-9]/, 'forms.validation.password')
    .regex(/[^A-Za-z0-9]/, 'forms.validation.password'),
  confirmPassword: z.string().min(1, 'validation.required'),
}).strict().refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'], message: 'registration.passwordMismatch'
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const userAccessSchema = userSchema.extend({
  tenant: z.object({ id: z.string(), name: z.string(), slug: z.string() }).nullable(),
  projectCount: z.number().int().nonnegative().default(0),
  lastLoginAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type UserAccess = z.infer<typeof userAccessSchema>;

export const notificationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  type: z.string().min(1),
  targetId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
  readAt: z.string().datetime().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

export const notificationsResponseSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
});
