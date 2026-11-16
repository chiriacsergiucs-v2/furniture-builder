// Find-it acceptance for entering a space and the focus strength (ADR-270, backlog N288), run against a production
// build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/enter-and-focus/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at 1280 px (the drawer head with these buttons is the desktop drawer) and finds everything
// by visible text: Edit inside this space, a double click, Editing inside with Exit, Esc exits first then goes up,
// Focus: Fade → Strong → Hide and what hide does to the drawing. Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { goCompose } from '../lib/steps.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} 1280px ${name}${detail ? ` — ${detail}` : ''}`);
};

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(url);
await page.getByRole('button', { name: 'New single piece' }).click();
await page
  .locator('dialog[open]')
  .getByRole('button', { name: /Sideboard/ })
  .first()
  .click();
await page.locator('main.work').waitFor({ state: 'visible' });
await goCompose(page);

const spaces = page.locator('figure.elevation .el-space');
const tapBay = async (i) => {
  const b = await spaces.nth(i).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.25);
  await page.waitForTimeout(250);
};
const status = page.getByRole('status').filter({ hasText: 'Editing inside:' });
const enterBtn = page.getByRole('button', { name: 'Edit inside this space' });
const exitBtn = page.getByRole('button', { name: 'Exit' });

// Pick the divided interior in the Structure tree (ADR-268): it offers to be entered.
await page.getByRole('treeitem', { name: /^Interior/ }).click();
await page.waitForTimeout(250);
check('a divided space offers Edit inside this space', await enterBtn.isVisible());
await enterBtn.click();
check(
  'Editing inside: … shows',
  await status.isVisible(),
  (await status.innerText()).replace(/\s+/g, ' '),
);
check('with an Exit button', await exitBtn.isVisible());

// While entered a tap outside the entered space changes nothing; taps inside go in, never to the whole piece.
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Esc exits first', (await status.count()) === 0);
check('and keeps the selection', await enterBtn.isVisible());
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('a second Esc goes up a level', (await enterBtn.count()) === 0);

// A double click enters the divided space under the pointer. The interior of a cabinet is the whole piece again for
// taps (ADR-083), so divide the left bay (Stacked) to get a divided space inside it.
const leftBay = page.getByRole('heading', { name: 'Left: Shelves' });
for (let i = 0; i < 4 && !(await leftBay.isVisible().catch(() => false)); i++) await tapBay(0);
await page.getByRole('button', { name: 'Stacked', exact: true }).click();
await page.waitForTimeout(300);
const b = await spaces.nth(0).boundingBox();
await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height * 0.25);
await page.waitForTimeout(300);
check(
  'a double click enters a divided space',
  (await status.count()) === 1,
  (await status.allInnerTexts()).join('|'),
);
await exitBtn.click();
check('Exit leaves it', (await status.count()) === 0);

// Focus strength: with a space selected, the rest fades; Hide removes it from the drawing.
await page.getByRole('treeitem', { name: /^Whole/ }).click();
await tapBay(0);
await tapBay(0);
const focus = (name) => page.getByRole('button', { name });
const faded = () => page.locator('figure.elevation .faded').count();
check('Focus: Fade is the default', await focus('Focus: Fade').isVisible());
const nFade = await faded();
check('the rest of the piece is drawn faded', nFade > 0, `${nFade} faded shapes`);
await focus('Focus: Fade').click();
check('it cycles to Focus: Strong', await focus('Focus: Strong').isVisible());
const opacity = await page
  .locator('figure.elevation svg')
  .first()
  .evaluate((el) => el.style.getPropertyValue('--focus-opacity'));
check(
  'Strong fades more',
  Number(opacity) > 0 && Number(opacity) < 0.28,
  `--focus-opacity ${opacity}`,
);
await focus('Focus: Strong').click();
check('and to Focus: Hide', await focus('Focus: Hide').isVisible());
const nHide = await faded();
check('Hide removes the faded shapes from the drawing', nHide === 0, `${nHide} left`);
await focus('Focus: Hide').click();
check('and back to Focus: Fade', await focus('Focus: Fade').isVisible());

check('no page errors', errors.length === 0, errors.join('; ').slice(0, 120));
await page.screenshot({ path: `${out}/enter-and-focus-1280.png` });
await ctx.close();
await browser.close();
if (failed) {
  console.log(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('all checks passed');
