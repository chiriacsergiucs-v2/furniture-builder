// @vitest-environment jsdom
// Find-it for G-454, in jsdom (ADR-108), at 390 and 1280 px: Projects lists "Versions of deleted projects" under the
// projects, with "Restore as a new project" and Delete, with no project open.
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { newProjectNamed, renderApp, toProjects, WIDTHS } from './setup';

describe.each(WIDTHS)(
  'versions of deleted projects on Projects at %ipx (find-it, G-454)',
  (width) => {
    it('Projects › Versions of deleted projects: Restore as a new project saves a copy; Delete asks and removes one', async () => {
      const { user } = await renderApp(width);
      const dbm = await import('../../src/persist/db');
      const { makeVersion } = await import('../../src/core/projectVersion');
      const { newProject: blank } = await import('../../src/core/project');
      await dbm.db.projectVersions.clear();
      const gone = { ...blank(`Old pantry ${width}`), id: `pantry-${width}` };
      await dbm.saveProject(gone);
      await dbm.saveProjectVersion(makeVersion(gone, 'manual', new Date('2026-11-01T10:00:00Z')));
      await dbm.saveProjectVersion(makeVersion(gone, 'session', new Date('2026-11-02T10:00:00Z')));
      await dbm.deleteProject(gone.id);

      await newProjectNamed(user, 'Open now project');
      await toProjects(user);
      const page = screen.getByRole('main', { name: 'Projects' });
      const folded = await within(page).findByText(
        'Versions of deleted projects (2)',
        { selector: 'summary' },
        { timeout: 5000 },
      );
      await user.click(folded);
      const list = within(page).getByRole('list', { name: 'Versions of deleted projects (2)' });
      expect(within(list).getAllByText(`Old pantry ${width}`)).toHaveLength(2);

      // Delete asks first; Cancel keeps it.
      const del = within(list).getAllByRole('button', { name: /^Delete the version of / });
      await user.click(del[0]);
      let ask = await screen.findByRole('dialog', { name: 'Confirm' });
      await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
      expect(await dbm.db.projectVersions.count()).toBe(2);
      await user.click(del[0]);
      ask = await screen.findByRole('dialog', { name: 'Confirm' });
      await user.click(within(ask).getByRole('button', { name: 'Delete' }));
      await within(page).findByRole('list', { name: 'Versions of deleted projects (1)' });
      expect(await dbm.db.projectVersions.count()).toBe(1);

      // Restore as a new project saves a copy; the version stays.
      await user.click(within(page).getByRole('button', { name: 'Restore as a new project' }));
      await vi.waitFor(
        async () => {
          const rows = await dbm.listProjects();
          expect(rows.some((r) => r.name === `Old pantry ${width} (restored)`)).toBe(true);
        },
        { timeout: 5000 },
      );
      expect(await dbm.db.projectVersions.count()).toBe(1);
    });
  },
);
