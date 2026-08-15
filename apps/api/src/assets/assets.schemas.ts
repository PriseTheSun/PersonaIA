import { z } from 'zod';

export const createAssetSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  data: z.record(z.unknown()).default({}),
  workspaceIds: z.array(z.string().uuid()).max(100).default([]),
}).strict();

export const updateAssetSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  data: z.record(z.unknown()).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export const assetQuerySchema = z.object({ workspaceId: z.string().uuid().optional() }).strict();

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type AssetQuery = z.infer<typeof assetQuerySchema>;
