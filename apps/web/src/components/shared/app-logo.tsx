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

export function AppLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center', className)} role="img" aria-label="PersonaIA">
      {compact ? (
        <span className="block size-8 bg-primary" style={compactLogoMaskStyle} aria-hidden="true" />
      ) : (
        <span className="block h-12 w-[190px] bg-primary" style={logoMaskStyle} aria-hidden="true" />
      )}
    </span>
  );
}
