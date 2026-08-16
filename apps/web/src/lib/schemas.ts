import { z } from 'zod';
import { strongPassword } from './password-policy';

export const roleSchema = z.enum(['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER']);
export type Role = z.infer<typeof roleSchema>;

export const clientRoleSchema = z.enum(['CLIENT_ADMIN', 'CLIENT_MEMBER']);
export type ClientRole = z.infer<typeof clientRoleSchema>;

export const workspaceRoleSchema = z.enum(['WORKSPACE_ADMIN', 'WORKSPACE_MEMBER']);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const membershipStatusSchema = z.enum(['PENDING_APPROVAL', 'PENDING', 'INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED', 'ARCHIVED']);
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export const featureSchema = z.enum(['PERSONA', 'RESEARCH', 'SIMULATION', 'DASHBOARD']);
export type FunctionalFeature = z.infer<typeof featureSchema>;

export const accessLevelSchema = z.enum(['READ', 'WRITE', 'ADMIN']);
export type AccessLevel = z.infer<typeof accessLevelSchema>;

export const permissionEffectSchema = z.enum(['ALLOW', 'DENY']);
export type PermissionEffect = z.infer<typeof permissionEffectSchema>;

export const functionalPermissionSchema = z.object({
  feature: featureSchema,
  level: accessLevelSchema,
  effect: permissionEffectSchema.default('ALLOW'),
  source: z.enum(['WORKSPACE', 'PROJECT', 'ROLE']).optional(),
  inherited: z.boolean().optional(),
});
export type FunctionalPermission = z.infer<typeof functionalPermissionSchema>;

const canonicalAuthContextSchema = z.object({
  tenantId: z.string().min(1),
  tenantName: z.string().min(1),
  tenantSlug: z.string().optional(),
  clientRole: clientRoleSchema.optional(),
  status: membershipStatusSchema.default('ACTIVE'),
  hasProjectAccess: z.boolean().optional(),
  workspaces: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: workspaceRoleSchema,
    status: membershipStatusSchema.default('ACTIVE'),
    permissions: z.array(functionalPermissionSchema).default([]),
  })).default([]),
});

const backendAuthContextSchema = z.object({
  tenantId: z.string().min(1),
  role: clientRoleSchema,
  status: membershipStatusSchema.default('ACTIVE'),
  selected: z.boolean().optional(),
  hasProjectAccess: z.boolean().optional(),
  tenant: z.object({ id: z.string(), name: z.string(), slug: z.string().optional(), status: z.string().optional() }),
  workspaces: z.array(z.object({
    workspaceId: z.string().min(1),
    role: workspaceRoleSchema,
    status: membershipStatusSchema.default('ACTIVE'),
    workspace: z.object({ id: z.string(), name: z.string(), slug: z.string().optional(), isDefault: z.boolean().optional() }),
    permissions: z.array(functionalPermissionSchema).default([]),
  })).default([]),
});

export const authContextSchema = z.union([canonicalAuthContextSchema, backendAuthContextSchema]).transform((context) => 'tenantName' in context ? context : ({
  tenantId: context.tenantId,
  tenantName: context.tenant.name,
  tenantSlug: context.tenant.slug,
  clientRole: context.role,
  status: context.status,
  hasProjectAccess: context.hasProjectAccess,
  workspaces: context.workspaces.map((item) => ({
    id: item.workspaceId,
    name: item.workspace.name,
    role: item.role,
    status: item.status,
    permissions: item.permissions,
  })),
}));
export type AuthContext = z.infer<typeof authContextSchema>;

export const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: roleSchema.default('PROJECT_USER'),
  tenantId: z.string().nullable().optional(),
  status: membershipStatusSchema.default('ACTIVE'),
  hasAvatar: z.boolean().optional(),
  avatarUpdatedAt: z.string().datetime().nullable().optional(),
  contexts: z.array(authContextSchema).optional(),
  createdAt: z.string().datetime().optional(),
});
export type User = z.infer<typeof userSchema>;

export const platformIdentitySchema = userSchema.extend({
  tenantId: z.string().nullable().optional(),
  clientMemberships: z.array(z.object({
    tenantId: z.string().min(1),
    role: clientRoleSchema,
    status: membershipStatusSchema,
    tenant: z.object({ id: z.string(), name: z.string(), slug: z.string(), status: z.string().optional() }),
  })).default([]),
  membershipCount: z.number().int().nonnegative().default(0),
  lastLoginAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type PlatformIdentity = z.infer<typeof platformIdentitySchema>;

export const tenantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'REMOVED']).default('ACTIVE'),
  segment: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  adminCount: z.number().int().nonnegative().default(0),
  memberCount: z.number().int().nonnegative().default(0),
  workspaceCount: z.number().int().nonnegative().default(0),
  projectCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
});
export type Tenant = z.infer<typeof tenantSchema>;

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  workspaceId: z.string().min(1).nullable().optional(),
  workspace: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  memberCount: z.number().int().nonnegative().default(0),
  accessCode: z.object({
    code: z.string().length(12),
    expiresAt: z.string().datetime(),
  }).optional(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const workspaceSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).default('ACTIVE'),
  isDefault: z.boolean().default(false),
  memberCount: z.number().int().nonnegative().default(0),
  projectCount: z.number().int().nonnegative().default(0),
  personaCount: z.number().int().nonnegative().default(0),
  questionnaireCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  _count: z.object({ memberships: z.number().optional(), projects: z.number().optional(), personas: z.number().optional(), questionnaires: z.number().optional() }).optional(),
}).transform((workspace) => ({
  ...workspace,
  memberCount: workspace._count?.memberships ?? workspace.memberCount,
  projectCount: workspace._count?.projects ?? workspace.projectCount,
  personaCount: workspace._count?.personas ?? workspace.personaCount,
  questionnaireCount: workspace._count?.questionnaires ?? workspace.questionnaireCount,
}));
export type Workspace = z.infer<typeof workspaceSchema>;

export const clientMembershipSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  role: clientRoleSchema,
  status: membershipStatusSchema,
  user: userSchema,
  requestedProject: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    status: z.string(),
  }).nullable().optional(),
  workspaceCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  _count: z.object({ workspaceMemberships: z.number().optional() }).optional(),
}).transform((membership) => ({ ...membership, workspaceCount: membership._count?.workspaceMemberships ?? membership.workspaceCount }));
export type ClientMembership = z.infer<typeof clientMembershipSchema>;

export const workspaceMembershipSchema = z.object({
  id: z.string().optional(),
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  role: workspaceRoleSchema,
  status: membershipStatusSchema,
  user: userSchema,
  permissions: z.array(functionalPermissionSchema).default([]),
  effectivePermissions: z.array(functionalPermissionSchema).default([]),
  workspacePermissions: z.array(functionalPermissionSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).transform((membership) => ({
  ...membership,
  permissions: membership.workspacePermissions ?? membership.permissions,
  effectivePermissions: membership.effectivePermissions.length ? membership.effectivePermissions : (membership.workspacePermissions ?? membership.permissions),
}));
export type WorkspaceMembership = z.infer<typeof workspaceMembershipSchema>;

const assetBaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  workspaceIds: z.array(z.string()).default([]),
  workspaces: z.array(z.union([
    z.object({ id: z.string(), name: z.string() }),
    z.object({ workspaceId: z.string(), workspace: z.object({ id: z.string(), name: z.string() }) }).transform((association) => association.workspace),
  ])).default([]),
  activeProjectUsageCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const personaSchema = assetBaseSchema.extend({ kind: z.literal('PERSONA').optional() });
export type Persona = z.infer<typeof personaSchema>;

export const questionnaireSchema = assetBaseSchema.extend({
  kind: z.literal('QUESTIONNAIRE').optional(),
  questionCount: z.number().int().nonnegative().default(0),
});
export type Questionnaire = z.infer<typeof questionnaireSchema>;

export const questionnaireQuestionTypeSchema = z.enum(['MULTIPLE_CHOICE', 'FREE_TEXT']);
export type QuestionnaireQuestionType = z.infer<typeof questionnaireQuestionTypeSchema>;

export const questionnaireOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(300),
  position: z.number().int().nonnegative(),
});
export type QuestionnaireOption = z.infer<typeof questionnaireOptionSchema>;

export const questionnaireQuestionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  questionnaireId: z.string().uuid(),
  prompt: z.string().min(1).max(1000),
  type: questionnaireQuestionTypeSchema,
  position: z.number().int().nonnegative(),
  options: z.array(questionnaireOptionSchema).default([]),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type QuestionnaireQuestion = z.infer<typeof questionnaireQuestionSchema>;

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
  scope: z.enum(['PLATFORM', 'TENANT', 'WORKSPACE']),
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
  projectCode: z.string().trim().toUpperCase().refine((value) => value === '' || /^[A-HJ-NP-Z2-9]{12}$/.test(value), 'registration.invalidProjectCodeFormat').optional(),
  password: strongPassword,
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
