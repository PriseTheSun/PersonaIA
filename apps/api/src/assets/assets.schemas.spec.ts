import { questionnaireQuestionSchema } from './assets.schemas';

describe('questionnaireQuestionSchema', () => {
  it('accepts a free-text question without alternatives', () => {
    expect(questionnaireQuestionSchema.parse({ prompt: 'Como você se sente?', type: 'FREE_TEXT' })).toEqual({
      prompt: 'Como você se sente?',
      type: 'FREE_TEXT',
    });
  });

  it('requires at least two distinct alternatives for multiple choice', () => {
    expect(questionnaireQuestionSchema.safeParse({ prompt: 'Qual opção?', type: 'MULTIPLE_CHOICE', options: ['A'] }).success).toBe(false);
    expect(questionnaireQuestionSchema.safeParse({ prompt: 'Qual opção?', type: 'MULTIPLE_CHOICE', options: ['Sim', 'sim'] }).success).toBe(false);
    expect(questionnaireQuestionSchema.safeParse({ prompt: 'Qual opção?', type: 'MULTIPLE_CHOICE', options: ['Sim', 'Não'] }).success).toBe(true);
  });

  it('rejects alternatives on a free-text question', () => {
    expect(questionnaireQuestionSchema.safeParse({ prompt: 'Conte mais', type: 'FREE_TEXT', options: ['Não permitido'] }).success).toBe(false);
  });
});
