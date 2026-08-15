import type { ReactNode } from 'react';
import { LanguageSelector } from '@/components/shared/language-selector';
import { ThemeSelector } from '@/components/shared/theme-selector';
import { cn } from '@/lib/utils';
import { AuthBrandPanel } from './auth-brand-panel';

export function AuthLayout({ labelledBy, contentClassName, children }: { labelledBy: string; contentClassName?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/50 p-4 sm:p-6 lg:p-8">
      <section className="relative grid w-full max-w-none overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm lg:grid-cols-[0.96fr_1.04fr]" aria-labelledby={labelledBy}>
        <AuthBrandPanel />
        <div className="relative flex min-h-[calc(100svh-2rem)] items-center px-5 py-16 sm:min-h-[640px] sm:px-10 lg:min-h-[650px] lg:px-14 lg:py-8 xl:px-16">
          <div className="absolute right-3 top-3 flex items-center sm:right-5 sm:top-5"><LanguageSelector /><ThemeSelector /></div>
          <div className={cn('mx-auto w-full', contentClassName)}>{children}</div>
        </div>
      </section>
    </main>
  );
}

export function PublicisEdgeSignature({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-1', className)} aria-label="Publicis Edge">
      <div className="flex flex-col items-center text-muted-foreground" aria-hidden="true">
        <span className="text-[0.625rem] font-semibold leading-none tracking-[0.28em]">PUBLICIS</span>
        <span className="mt-1 text-[2rem] font-black leading-[0.8] tracking-[-0.04em]">EDGE</span>
      </div>
    </div>
  );
}
