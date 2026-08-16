import { z } from 'zod';
import { questionnaireQuestionTypeSchema } from '@/lib/schemas';

export const questionnaireQuestionFormSchema = z.object({
  prompt: z.string().trim().min(1, 'questionnaires.promptRequired').max(1000),
  type: questionnaireQuestionTypeSchema,
  options: z.array(z.object({ label: z.string().trim().max(300) })).max(20),
}).superRefine((question, context) => {
  if (question.type !== 'MULTIPLE_CHOICE') return;
  const validOptions = question.options.map(({ label }) => label.trim()).filter(Boolean);
  if (validOptions.length < 2) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'questionnaires.minimumOptions' });
  }
  const normalized = validOptions.map((option) => option.toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'questionnaires.uniqueOptions' });
  }
});

export type QuestionnaireQuestionFormInput = z.infer<typeof questionnaireQuestionFormSchema>;
