import { describe, expect, it } from 'vitest';
import { createProjectFormSchema, createTenantFormSchema, functionalPermissionInputSchema, createUserFormSchema, moveUserFormSchema, strongPassword } from './form-schemas';

describe('mutation form schemas', () => {
  it('enforces the backend password policy', () => {
    expect(strongPassword.safeParse('weak-password').success).toBe(false);
    expect(strongPassword.safeParse('Secure!Pass123').success).toBe(true);
  });

  it('rejects unsafe tenant slugs', () => {
    const result = createTenantFormSchema.safeParse({ name: 'Acme', slug: '../acme', segment: 'Research', adminName: 'Admin User', adminEmail: 'admin@acme.test', adminPassword: 'Secure!Pass123' });
    expect(result.success).toBe(false);
  });

  it('rejects moving a user into the source project', () => {
    const id = 'b943aeb6-dd9a-49fd-a8b4-bf206e234b52';
    expect(moveUserFormSchema.safeParse({ fromProjectId: id, toProjectId: id, permission: 'VIEWER' }).success).toBe(false);
  });

  it('accepts project membership presets for a new user', () => {
    expect(createUserFormSchema.safeParse({ name: 'Project User', email: 'user@example.com', password: 'Secure!Pass123', projectIds: [], permission: 'CONTRIBUTOR' }).success).toBe(true);
  });

  it('accepts an optional workspace folder and validates it when provided', () => {
    expect(createProjectFormSchema.safeParse({ name: 'Project without workspace', description: '' }).success).toBe(true);
    expect(createProjectFormSchema.safeParse({ workspaceId: 'b943aeb6-dd9a-49fd-a8b4-bf206e234b52', name: 'Project A', description: '' }).success).toBe(true);
    expect(createProjectFormSchema.safeParse({ workspaceId: 'workspace-1', name: 'Project A', description: '' }).success).toBe(false);
  });

  it('accepts explicit functional denial as a first-class permission', () => {
    expect(functionalPermissionInputSchema.safeParse({ feature: 'PERSONA', level: 'WRITE', effect: 'DENY' }).success).toBe(true);
  });
});
