import { Check, Copy, KeyRound, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { apiRequest } from '@/lib/api';

const responseSchema = z.object({
  projectId: z.string(),
  code: z.string().length(12),
  expiresAt: z.string().datetime(),
});

type AccessCode = Pick<z.infer<typeof responseSchema>, 'code' | 'expiresAt'>;

export function ProjectAccessCode({ projectId, initial }: { projectId: string; initial: AccessCode }) {
  const { t } = useTranslation();
  const [accessCode, setAccessCode] = useState(initial);
  const [remainingSeconds, setRemainingSeconds] = useState(() => secondsUntil(initial.expiresAt));
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const refreshedExpiry = useRef<string | null>(null);
  const initialCode = initial.code;
  const initialExpiresAt = initial.expiresAt;

  useEffect(() => {
    setAccessCode({ code: initialCode, expiresAt: initialExpiresAt });
    setRemainingSeconds(secondsUntil(initialExpiresAt));
  }, [initialCode, initialExpiresAt]);

  useEffect(() => {
    const update = () => setRemainingSeconds(secondsUntil(accessCode.expiresAt));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [accessCode.expiresAt]);

  useEffect(() => {
    if (remainingSeconds > 0 || refreshing || refreshedExpiry.current === accessCode.expiresAt) return;
    refreshedExpiry.current = accessCode.expiresAt;
    setRefreshing(true);
    void apiRequest(`/projects/${encodeURIComponent(projectId)}/access-code`, responseSchema)
      .then((next) => {
        setAccessCode({ code: next.code, expiresAt: next.expiresAt });
        setRemainingSeconds(secondsUntil(next.expiresAt));
      })
      .catch(() => toast.error(t('projects.codeRefreshError')))
      .finally(() => setRefreshing(false));
  }, [accessCode.expiresAt, projectId, refreshing, remainingSeconds, t]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(accessCode.code);
      setCopied(true);
      toast.success(t('projects.codeCopied'));
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      toast.error(t('projects.codeCopyError'));
    }
  };

  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
  const seconds = (remainingSeconds % 60).toString().padStart(2, '0');

  return (
    <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5" aria-label={t('projects.accessCode')}>
      <KeyRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <code className="truncate font-mono text-xs font-semibold tracking-[0.12em] text-foreground">{accessCode.code}</code>
      <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
        {refreshing ? <LoaderCircle className="size-3.5 animate-spin" aria-label={t('projects.codeRefreshing')} /> : t('projects.codeExpiresIn', { time: `${minutes}:${seconds}` })}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="-mr-1 size-7" onClick={() => void copy()} aria-label={t('projects.copyCode')}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('projects.copyCode')}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function secondsUntil(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1_000));
}
