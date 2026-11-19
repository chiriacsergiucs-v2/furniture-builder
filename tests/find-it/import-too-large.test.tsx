// @vitest-environment jsdom
// Find-it for N342 (M-2): a file above 20 MB is refused by the importer with a visible message. From the bare app:
// Projects › Import a file. The File is tiny; its `size` getter is overridden to 20 MB + 1, so nothing big is allocated.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, toProjects, WIDTHS } from './setup';

describe.each(WIDTHS)('import of a too-large file at %ipx (find-it, N342)', (width) => {
  it('shows the too-large message and opens nothing', async () => {
    const { user } = await renderApp(width);
    await toProjects(user);
    const main = screen.getByRole('main', { name: 'Projects' });
    const input = within(main).getByLabelText('Import a design, project or project template file');
    const file = new File(['{}'], 'big.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: 20_000_001 });
    await user.upload(input, file);
    expect(await screen.findByText('That file is too large to import (over 20 MB).')).toBeTruthy();
    expect(screen.getByRole('main', { name: 'Projects' })).toBeTruthy();
  });
});
