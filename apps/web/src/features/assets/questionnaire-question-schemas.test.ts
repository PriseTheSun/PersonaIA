import { describe, expect, it } from 'vitest';
import { questionnaireQuestionFormSchema } from './questionnaire-question-schemas';

describe('questionnaireQuestionFormSchema', () => {
  it('accepts free-text questions without alternatives', () => {
    expect(questionnaireQuestionFormSchema.safeParse({ prompt: 'Conte sua experiência', type: 'FREE_TEXT', options: [] }).success).toBe(true);
  });

  it('requires two distinct alternatives for multiple choice', () => {
    expect(questionnaireQuestionFormSchema.safeParse({ prompt: 'Escolha', type: 'MULTIPLE_CHOICE', options: [{ label: 'Sim' }, { label: '' }] }).success).toBe(false);
    expect(questionnaireQuestionFormSchema.safeParse({ prompt: 'Escolha', type: 'MULTIPLE_CHOICE', options: [{ label: 'Sim' }, { label: 'sim' }] }).success).toBe(false);
    expect(questionnaireQuestionFormSchema.safeParse({ prompt: 'Escolha', type: 'MULTIPLE_CHOICE', options: [{ label: 'Sim' }, { label: 'Não' }] }).success).toBe(true);
  });
});
