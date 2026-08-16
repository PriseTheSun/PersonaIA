import { createInvitationSchema } from './invitations.schemas';

describe('createInvitationSchema', () => {
  it('normalizes defaults while keeping the project optional', () => {
    expect(createInvitationSchema.parse({ email: 'person@example.com' })).toEqual({
      email: 'person@example.com',
      role: 'CLIENT_MEMBER',
    });
  });

  it('rejects server-controlled fields and malformed identifiers', () => {
    expect(createInvitationSchema.safeParse({
      email: 'person@example.com',
      tenantId: '10000000-0000-4000-8000-000000000001',
      status: 'SENT',
      token: 'attacker-controlled',
    }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ email: 'person@example.com', projectId: 'not-a-uuid' }).success).toBe(false);
  });
});
