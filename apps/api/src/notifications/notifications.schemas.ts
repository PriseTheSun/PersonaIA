import { z } from 'zod';

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  status: z.enum(['ALL', 'UNREAD', 'READ']).default('ALL'),
}).strict();

export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
