import { zodResolver } from '@hookform/resolvers/zod';
import { AlignLeft, ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormDialog } from '@/components/shared/form-dialog';
import { MutationNotice } from '@/components/shared/inline-form';
import { ErrorState, LoadingRows } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest, apiVoid, csrfHeaders } from '@/lib/api';
import { questionnaireQuestionSchema, type Questionnaire, type QuestionnaireQuestion } from '@/lib/schemas';
import { questionnaireQuestionFormSchema, type QuestionnaireQuestionFormInput } from './questionnaire-question-schemas';

const questionsSchema = z.array(questionnaireQuestionSchema);
type EditorMode = { view: 'list' } | { view: 'create' } | { view: 'edit'; question: QuestionnaireQuestion };

export function QuestionnaireBuilderDialog({
  open,
  onOpenChange,
  tenantId,
  questionnaire,
  canWrite,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  questionnaire: Questionnaire;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EditorMode>({ view: 'list' });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const basePath = `/tenants/${encodeURIComponent(tenantId)}/questionnaires/${encodeURIComponent(questionnaire.id)}/questions`;
  const query = useApiQuery(
    (signal) => open ? apiRequest(basePath, questionsSchema, { signal }) : Promise.resolve([]),
    [open, tenantId, questionnaire.id],
  );

  useEffect(() => {
    if (!open) {
      setMode({ view: 'list' });
      setPendingDelete(null);
    }
  }, [open]);

  const remove = async (questionId: string) => {
    setDeleting(true);
    try {
      await apiVoid(`${basePath}/${encodeURIComponent(questionId)}`, { method: 'DELETE', headers: csrfHeaders() });
      setPendingDelete(null);
      toast.success(t('questionnaires.questionDeleted'));
      query.retry();
      onChanged();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('forms.error'));
    } finally {
      setDeleting(false);
    }
  };

  const title = mode.view === 'list'
    ? t('questionnaires.builderTitle', { name: questionnaire.name })
    : mode.view === 'create'
      ? t('questionnaires.newQuestion')
      : t('questionnaires.editQuestion');

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={t('questionnaires.builderDescription')}
    >
      {mode.view !== 'list' ? (
        <QuestionForm
          key={mode.view === 'edit' ? mode.question.id : 'new-question'}
          basePath={basePath}
          initial={mode.view === 'edit' ? mode.question : undefined}
          onCancel={() => setMode({ view: 'list' })}
          onSaved={() => {
            setMode({ view: 'list' });
            query.retry();
            onChanged();
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t('questionnaires.questionCount', { count: query.status === 'success' ? query.data.length : questionnaire.questionCount })}
            </p>
            {canWrite ? <Button type="button" onClick={() => setMode({ view: 'create' })}><Plus />{t('questionnaires.newQuestion')}</Button> : null}
          </div>
          {query.status === 'loading' ? <LoadingRows rows={3} /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : query.data.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-lg bg-muted/50 px-5 py-10 text-center">
              <span className="mb-3 grid size-10 place-items-center rounded-full bg-card"><ListChecks className="size-5 text-muted-foreground" aria-hidden="true" /></span>
              <h3 className="text-sm font-semibold">{t('questionnaires.emptyQuestions')}</h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{t('questionnaires.emptyQuestionsDescription')}</p>
            </div>
          ) : (
            <ol className="divide-y rounded-lg border">
              {query.data.map((question, index) => (
                <li key={question.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold" aria-hidden="true">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-sm font-medium leading-6">{question.prompt}</p>
                      <Badge variant="outline" className="mt-2 gap-1.5">
                        {question.type === 'MULTIPLE_CHOICE' ? <ListChecks className="size-3" aria-hidden="true" /> : <AlignLeft className="size-3" aria-hidden="true" />}
                        {t(question.type === 'MULTIPLE_CHOICE' ? 'questionnaires.typeMultipleChoice' : 'questionnaires.typeFreeText')}
                      </Badge>
                      {question.type === 'MULTIPLE_CHOICE' ? (
                        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                          {question.options.map((option) => <li key={option.id} className="flex gap-2"><span aria-hidden="true">○</span><span>{option.label}</span></li>)}
                        </ul>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon" aria-label={`${t('common.edit')}: ${question.prompt}`} onClick={() => setMode({ view: 'edit', question })}><Pencil /></Button>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={`${t('questionnaires.deleteQuestion')}: ${question.prompt}`} onClick={() => setPendingDelete(question.id)}><Trash2 /></Button>
                      </div>
                    ) : null}
                  </div>
                  {pendingDelete === question.id ? (
                    <section className="mt-4 rounded-md bg-muted px-4 py-3" aria-labelledby={`delete-question-${question.id}`}>
                      <h4 id={`delete-question-${question.id}`} className="text-sm font-semibold">{t('questionnaires.deleteQuestionConfirm')}</h4>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('questionnaires.deleteQuestionDescription')}</p>
                      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" disabled={deleting} onClick={() => setPendingDelete(null)}>{t('common.cancel')}</Button>
                        <Button type="button" variant="destructive" loading={deleting} onClick={() => { void remove(question.id); }}>{t('common.delete')}</Button>
                      </div>
                    </section>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </FormDialog>
  );
}

function QuestionForm({
  basePath,
  initial,
  onCancel,
  onSaved,
}: {
  basePath: string;
  initial?: QuestionnaireQuestion;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { register, control, watch, handleSubmit, formState: { errors, isSubmitting } } = useForm<QuestionnaireQuestionFormInput>({
    resolver: zodResolver(questionnaireQuestionFormSchema),
    defaultValues: {
      prompt: initial?.prompt ?? '',
      type: initial?.type ?? 'FREE_TEXT',
      options: initial?.options.length ? initial.options.map(({ label }) => ({ label })) : [{ label: '' }, { label: '' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'options' });
  const type = watch('type');

  const submit = handleSubmit(async (input) => {
    setError(null);
    const body = input.type === 'MULTIPLE_CHOICE'
      ? { prompt: input.prompt, type: input.type, options: input.options.map(({ label }) => label.trim()).filter(Boolean) }
      : { prompt: input.prompt, type: input.type };
    try {
      await apiRequest(
        initial ? `${basePath}/${encodeURIComponent(initial.id)}` : basePath,
        questionnaireQuestionSchema,
        { method: initial ? 'PUT' : 'POST', headers: csrfHeaders(), body },
      );
      toast.success(t('questionnaires.questionSaved'));
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('forms.error'));
    }
  });

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <MutationNotice message={error} type="error" />
      <div className="space-y-2">
        <Label htmlFor="question-prompt">{t('questionnaires.prompt')}</Label>
        <textarea
          id="question-prompt"
          rows={4}
          maxLength={1000}
          placeholder={t('questionnaires.promptPlaceholder')}
          aria-invalid={Boolean(errors.prompt)}
          aria-describedby={errors.prompt ? 'question-prompt-error' : undefined}
          className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground md:text-sm"
          {...register('prompt')}
        />
        {errors.prompt ? <p id="question-prompt-error" className="text-sm text-destructive" role="alert">{t(errors.prompt.message!)}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="question-type">{t('questionnaires.typeLabel')}</Label>
        <select id="question-type" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" {...register('type')}>
          <option value="FREE_TEXT">{t('questionnaires.typeFreeText')}</option>
          <option value="MULTIPLE_CHOICE">{t('questionnaires.typeMultipleChoice')}</option>
        </select>
      </div>
      {type === 'MULTIPLE_CHOICE' ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t('questionnaires.alternatives')}</legend>
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label className="sr-only" htmlFor={`question-option-${index}`}>{t('questionnaires.alternativeLabel', { number: index + 1 })}</Label>
                <Input id={`question-option-${index}`} placeholder={t('questionnaires.alternativeLabel', { number: index + 1 })} maxLength={300} {...register(`options.${index}.label`)} />
              </div>
              <Button type="button" variant="ghost" size="icon" disabled={fields.length <= 2} aria-label={t('questionnaires.removeAlternative', { number: index + 1 })} onClick={() => remove(index)}><X /></Button>
            </div>
          ))}
          {errors.options?.message ? <p className="text-sm text-destructive" role="alert">{t(errors.options.message)}</p> : null}
          <Button type="button" variant="outline" disabled={fields.length >= 20} onClick={() => append({ label: '' })}><Plus />{t('questionnaires.addAlternative')}</Button>
        </fieldset>
      ) : null}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" loading={isSubmitting}>{t('questionnaires.saveQuestion')}</Button>
      </div>
    </form>
  );
}
