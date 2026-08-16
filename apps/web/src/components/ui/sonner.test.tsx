import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppToaster } from './sonner';

const toasterSpy = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
  Toaster: (props: unknown) => {
    toasterSpy(props);
    return null;
  },
}));

describe('AppToaster', () => {
  it('anchors every toast stack to the bottom-left corner', () => {
    render(<AppToaster />);

    expect(toasterSpy).toHaveBeenLastCalledWith(expect.objectContaining({ position: 'bottom-left' }));
  });
});
