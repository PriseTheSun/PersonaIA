import type { ReactNode } from 'react';

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0 [&>button]:w-full sm:[&>button]:w-auto">{action}</div> : null}
    </div>
  );
}
