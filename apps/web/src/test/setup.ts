import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

function serializeConsoleArgument(value: unknown) {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

beforeEach(() => {
  for (const method of ['error', 'warn'] as const) {
    vi.spyOn(console, method).mockImplementation((...argumentsList: unknown[]) => {
      throw new Error(`Unexpected console.${method}: ${argumentsList.map(serializeConsoleArgument).join(' ')}`);
    });
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class ResizeObserverMock {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
});
