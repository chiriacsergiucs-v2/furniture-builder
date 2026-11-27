// @vitest-environment jsdom
// G-570 M6: one ErrorAlert for the error line many dialogs showed with a copied block.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErrorAlert } from '../src/ui/controls';

afterEach(cleanup);

describe('ErrorAlert', () => {
  it('says the message as an alert', () => {
    render(<ErrorAlert message="Could not be saved." />);
    expect(screen.getByRole('alert').textContent).toBe('Could not be saved.');
  });
  it('shows nothing without a message', () => {
    for (const message of [null, undefined, '']) {
      const { container } = render(<ErrorAlert message={message} />);
      expect(container.innerHTML).toBe('');
      cleanup();
    }
  });
});
