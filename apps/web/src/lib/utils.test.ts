import { describe, expect, it } from 'vitest';
import { cn, formatCompactNumber, getInitials } from './utils';

describe('UI utilities', () => {
  it('merges conflicting Tailwind classes', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4');
  });

  it('creates safe two-letter initials', () => {
    expect(getInitials('  Ana Maria Souza ')).toBe('AM');
    expect(getInitials('Erika')).toBe('E');
  });

  it('formats numbers using the active locale', () => {
    expect(formatCompactNumber(1200, 'en')).toMatch(/1\.2K/i);
  });
});
