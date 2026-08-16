import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(['CLIENT_ADMIN', 'CLIENT_MEMBER']).default('CLIENT_MEMBER'),
  projectId: z.string().uuid().optional(),
}).strict();

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
