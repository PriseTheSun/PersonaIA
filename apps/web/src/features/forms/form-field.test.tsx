import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from './form-field';

describe('FormField', () => {
  it('forwards form-library refs to the native input', () => {
    const inputRef = createRef<HTMLInputElement>();

    render(<FormField ref={inputRef} id="workspace-name" name="name" label="Nome" />);

    expect(inputRef.current).toBe(screen.getByRole('textbox', { name: 'Nome' }));
  });
});
