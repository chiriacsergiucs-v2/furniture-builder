// @vitest-environment jsdom
// Find-it for ADR-259 (UI audit, Views) at 1280 and 390 px: without WebGL (jsdom has none) the reason 3D is off is
// visible text beside the View switch, and 3D and Both point to it.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { projectWithTwoPieces, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('no 3D at %ipx (find-it, ADR-259)', (width) => {
  it('the sentence is shown beside the View switch and 3D points to it', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    const view = screen.getByRole('radiogroup', { name: 'View' });
    const three = within(view).getByRole('radio', { name: '3D' });
    const reason = screen.getAllByText(
      '3D preview is not available in this browser. The front view and parts list still work.',
    );
    expect(reason.length).toBeGreaterThan(0);
    expect(three?.getAttribute('aria-describedby')).toBe('no-3d-why');
  });
});
