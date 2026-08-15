import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

const logoSrc = '/brand/PersonaIA-logo.svg';
const compactLogoSrc = '/brand/favicon-personaia.svg';
const logoMaskStyle: CSSProperties = {
  WebkitMaskImage: `url("${logoSrc}")`,
  maskImage: `url("${logoSrc}")`,
  WebkitMaskPosition: 'left center',
  maskPosition: 'left center',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: 'auto 100%',
  maskSize: 'auto 100%',
};
const compactLogoMaskStyle: CSSProperties = {
  WebkitMaskImage: `url("${compactLogoSrc}")`,
  maskImage: `url("${compactLogoSrc}")`,
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
};

export function AppLogo({ compact = false, tone = 'default', className }: { compact?: boolean; tone?: 'default' | 'inverse'; className?: string }) {
  const colorClassName = tone === 'inverse' ? 'bg-white' : 'bg-[#0c1825] dark:bg-white';

  return (
    <span className={cn('inline-flex shrink-0 items-center', className)} role="img" aria-label="PersonaIA">
      {compact ? (
        <span className={cn('block size-8', colorClassName)} style={compactLogoMaskStyle} aria-hidden="true" />
      ) : (
        <span className={cn('block h-12 w-[190px]', colorClassName)} style={logoMaskStyle} aria-hidden="true" />
      )}
    </span>
  );
}
