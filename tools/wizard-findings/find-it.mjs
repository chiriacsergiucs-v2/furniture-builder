// Browser acceptance for ADR-194 (CLAUDE.md R3, `- Acceptance: browser`): the New-piece wizard's footer, defaults
// button, cards, field errors, focus and counters, on the production build, from the bare app at 390 and 1280 px.
//   pnpm build && pnpm preview --port 4175 --strictPort &
//   node tools/wizard-findings/find-it.mjs http://127.0.0.1:4175/furniture-builder/ <out dir>
// Finds everything by role and visible text. Not part of `pnpm test`.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4175/furniture-builder/';
const out = process.argv[3] ?? '/tmp/furniture-wizard-findings';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: process.env.CHROMIUM_PATH
    ? ['--disable-gpu', '--disable-software-rasterizer', '--use-gl=disabled']
    : [],
});
let passed = 0;
let failed = 0;
try {
  for (const width of [390, 1280]) {
    const phone = width < 500;
    const context = await browser.newContext({
      viewport: { width, height: phone ? 844 : 900 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const check = (name, ok, detail = '') => {
      console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
      if (ok) passed++;
      else failed++;
    };
    const shot = (name) => page.screenshot({ path: `${out}/${name}-${width}.png` });
    const noSideScroll = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    const box = async (loc) => {
      const b = await loc.boundingBox();
      if (!b) throw Error('not visible');
      return b;
    };

    await page.goto(url);
    await page.getByRole('link', { name: /Catalog/ }).click();
    await page.getByRole('button', { name: 'New piece', exact: true }).click();
    const wiz = page.getByRole('dialog', { name: 'New piece' });
    await wiz.getByRole('heading', { name: 'Type' }).waitFor();

    // 3: the Type footer. On a phone Back | Next share the first row, the defaults button sits full width under them.
    const back = wiz.getByRole('button', { name: 'Back', exact: true });
    const next = wiz.getByRole('button', { name: 'Next', exact: true });
    const defaults = wiz.getByRole('button', { name: 'Use Cabinet (closed box)', exact: true });
    await shot('1-type-footer');
    const [b, n, d] = [await box(back), await box(next), await box(defaults)];
    if (phone) {
      check(
        'Type footer: Back and Next on the first row',
        Math.abs(b.y - n.y) < 2 && n.x > b.x,
        `Back y=${b.y} Next y=${n.y}`,
      );
      check(
        'Type footer: the defaults button full width under them',
        d.y >= n.y + n.height - 1 && d.width >= b.width + n.width,
        `defaults y=${d.y} w=${d.width}`,
      );
    } else
      check(
        'Type footer: Back, defaults and Next on one row',
        Math.abs(b.y - n.y) < 2 && Math.abs(d.y - n.y) < 2 && d.x < n.x,
      );
    check('no horizontal page scroll on the Type step', await noSideScroll());

    // 4: the defaults button hides once a type is chosen.
    await wiz.getByRole('radio', { name: /^Cabinet \(closed box\)/ }).click();
    check(
      'the defaults button hides once a type is chosen',
      (await wiz.getByRole('button', { name: /^Use Cabinet/ }).count()) === 0,
    );
    check('Next stays in reach', await next.isVisible());

    // 5: card buttons named after their cards; the warnings listed; the buttons of a row line up.
    const cards = wiz.getByRole('region', { name: 'Suggested combinations' });
    const uses = cards.getByRole('button', { name: /^Use this: / });
    await uses.first().scrollIntoViewIfNeeded();
    check(
      'card buttons are named "Use this: <label>"',
      (await uses.count()) === 6 &&
        (await cards.getByRole('button', { name: 'Use this', exact: true }).count()) === 0,
      await uses.first().getAttribute('aria-label'),
    );
    const warning = cards
      .getByText('Door 798 mm wide; over ~600 mm (typical) consider two doors.')
      .first();
    await warning.scrollIntoViewIfNeeded();
    check('a card with warnings lists their messages', await warning.isVisible());
    await shot('2-cards');
    const tops = [];
    for (let k = 0; k < (await uses.count()); k++) tops.push((await box(uses.nth(k))).y);
    const rowOf = async (k) => (await box(cards.locator('li.wz-card').nth(k))).y;
    const r0 = await rowOf(0);
    const sameRow = [];
    for (let k = 0; k < tops.length; k++) if (Math.abs((await rowOf(k)) - r0) < 2) sameRow.push(k);
    check(
      'the buttons of a row of cards line up',
      sameRow.length > 1 && sameRow.every((k) => Math.abs(tops[k] - tops[sameRow[0]]) < 2),
      `${sameRow.length} cards in the first row`,
    );
    check('no horizontal page scroll with the cards', await noSideScroll());

    // 8: the second button.
    check(
      'the cards\' second button reads "Continue by hand"',
      await cards.getByRole('button', { name: 'Continue by hand', exact: true }).isVisible(),
    );

    // 7: Next moves the focus to the step heading.
    await next.click();
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? '');
    check('Next moves the focus to the step heading', focused === 'Size', focused);

    // 6: Width "abc": the box is invalid, the error under it, once.
    const widthBox = wiz.getByRole('textbox', { name: /^Width/ });
    await widthBox.fill('abc');
    await widthBox.press('Tab');
    const message = 'Width must be a whole number from 200 to 3000 mm.';
    const wb = await box(widthBox);
    const eb = await box(wiz.getByText(message));
    check(
      'Width "abc": aria-invalid, the error under the box, once',
      (await widthBox.getAttribute('aria-invalid')) === 'true' &&
        (await wiz.getByText(message).count()) === 1 &&
        eb.y >= wb.y + wb.height - 1,
    );
    await shot('3-width-error');
    check('no horizontal page scroll with a field error', await noSideScroll());
    await widthBox.fill('800');
    await widthBox.press('Tab');

    // 7: counters name their compartment (Wardrobe: two compartments).
    await wiz.getByRole('button', { name: 'Type', exact: true }).click();
    await wiz.getByRole('radio', { name: /^Wardrobe/ }).click();
    for (let k = 0; k < 4 && !(await wiz.getByRole('heading', { name: 'Contents' }).count()); k++)
      await next.click();
    check(
      'counters read "Fewer shelves in compartment 2"',
      await wiz.getByRole('button', { name: 'Fewer shelves in compartment 2' }).isVisible(),
    );
    await shot('4-contents');
    check('no horizontal page scroll on Contents', await noSideScroll());
    check('no page errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
