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
export const replaceAssetWorkspacesSchema = z.object({
  workspaceIds: z.array(z.string().uuid()).max(100),
}).strict().transform(({ workspaceIds }) => ({ workspaceIds: [...new Set(workspaceIds)] }));

const multipleChoiceQuestionSchema = z.object({
  prompt: z.string().trim().min(1).max(1000),
  type: z.literal('MULTIPLE_CHOICE'),
  options: z.array(z.string().trim().min(1).max(300)).min(2).max(20),
}).strict();

const freeTextQuestionSchema = z.object({
  prompt: z.string().trim().min(1).max(1000),
  type: z.literal('FREE_TEXT'),
}).strict();

export const questionnaireQuestionSchema = z.discriminatedUnion('type', [
  multipleChoiceQuestionSchema,
  freeTextQuestionSchema,
]).superRefine((question, context) => {
  if (question.type !== 'MULTIPLE_CHOICE') return;
  const normalized = question.options.map((option) => option.toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'As alternativas devem ser diferentes.' });
  }
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type AssetQuery = z.infer<typeof assetQuerySchema>;
export type ReplaceAssetWorkspacesInput = z.output<typeof replaceAssetWorkspacesSchema>;
export type QuestionnaireQuestionInput = z.output<typeof questionnaireQuestionSchema>;
