import { z } from 'zod';

export const dashboardRangeSchema = z.enum(['7d', '30d', '12m', '5y']).default('30d');

export const dashboardQuerySchema = z.object({
  range: dashboardRangeSchema,
}).strict();

export type DashboardRange = z.infer<typeof dashboardRangeSchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
