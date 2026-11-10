// @vitest-environment jsdom
// Find-it for ADR-258 (Checks) and ADR-260 (Output) at 1280 and 390 px: with an error, Print assembly steps, Front
// view drawing and Fusion 360 script are off with the reason; the Checks tab is named with what its badge counts; the
// Results tabs take the arrow keys with one Tab stop.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

async function brokenPiece(width: number) {
  const app = await renderApp(width);
  const { templates } = await import('../../src/core/design');
  const { buildModel } = await import('../../src/core/build');
  const { resizeProduct } = await import('../../src/core/pieceSize');
  const { useDesign } = await import('../../src/store/designStore');
  const base = templates[0].create();
  let bad = base;
  for (const w of [40, 20, 10, 5]) {
    bad = { ...base, name: 'Broken', product: resizeProduct(base.product, 'width', w) };
    if (buildModel(bad).diagnostics.some((x) => x.severity === 'error')) break;
  }
  await app.user.click(await screen.findByRole('button', { name: 'New single piece' }));
  await app.user.click(
    within(await screen.findByRole('dialog')).getAllByRole('button', {
      name: /Chest of drawers/,
    })[0],
  );
  await screen.findByRole('button', { name: 'Settings' });
  useDesign.getState().load(bad);
  return app;
}

describe.each(WIDTHS)(
  'exports and checks with an error at %ipx (find-it, ADR-258, ADR-260)',
  (width) => {
    it('Front view drawing, Fusion 360 script and Print assembly steps are off with the reason', async () => {
      const { user } = await brokenPiece(width);
      await user.click(screen.getByLabelText('More'));
      for (const name of [/Front view drawing/, /Fusion 360 script/]) {
        const b = (await screen.findByRole('button', { name })) as HTMLButtonElement;
        expect(b.disabled).toBe(true);
        expect(b.textContent).toMatch(/Fix the problems listed under Checks first/);
      }
      await user.keyboard('{Escape}');
      await user.click(screen.getAllByRole('tab', { name: /Assembly/ })[0]);
      const pr = (await screen.findByRole('button', {
        name: 'Print assembly steps',
      })) as HTMLButtonElement;
      expect(pr.disabled).toBe(true);
    });

    it('the Checks tab is named with what it counts; the Results tabs take the arrow keys', async () => {
      const { user } = await brokenPiece(width);
      const results = screen.getByRole('tablist', { name: 'Results' });
      const checks = within(results).getByRole('tab', { name: /^Checks: \d+ problems?$/ });
      expect(checks).toBeTruthy();
      const tabs = within(results).getAllByRole('tab');
      expect(tabs.filter((x) => x.tabIndex === 0)).toHaveLength(1);
      const parts = within(results).getByRole('tab', { name: /^Parts/ });
      await user.click(parts);
      parts.focus();
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement?.textContent).toMatch(/^Sheets/);
    });
  },
);
