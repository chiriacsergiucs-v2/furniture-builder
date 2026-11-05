// Production acceptance for ADR-198. Run with the existing Playwright browser tooling, as other tools/* scripts.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const url = process.argv[2] ?? 'http://127.0.0.1:4173/furniture-builder/';
const out = process.argv[3] ?? '/tmp/furniture-shell-acceptance';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: process.env.CHROMIUM_PATH
    ? ['--disable-gpu', '--disable-software-rasterizer', '--use-gl=disabled']
    : [],
});
let count = 0;
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
    });
    const page = await context.newPage();
    const check = (name, ok) => {
      if (!ok) throw Error(`${width}px ${name}`);
      console.log(`PASS ${width}px ${name}`);
      count++;
    };
    await page.goto(url);
    await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
    await page.screenshot({ path: `${out}/projects-${width}.png` });
    await page.getByRole('button', { name: 'New single piece', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Sideboard/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: /^Settings:/ });
    const input = dialog.getByRole('textbox', { name: 'Width', exact: true });
    const before = Number(await input.inputValue());
    await input.fill(String(before + 50));
    await input.press('Tab');
    await dialog.getByRole('button', { name: 'Done', exact: true }).focus();
    await page.keyboard.press('Control+z');
    check('dialog shortcut leaves size intact', Number(await input.inputValue()) === before + 50);
    // A real pointer drag starting on text and ending on the backdrop must keep the dialog open.
    const heading = await dialog.getByRole('heading').first().boundingBox();
    const box = await dialog.boundingBox();
    const outside =
      box.x > 5 ? { x: box.x - 3, y: Math.max(1, box.y) } : { x: 1, y: Math.max(1, box.y - 3) };
    await page.mouse.move(heading.x + 8, heading.y + 8);
    await page.mouse.down();
    await page.mouse.move(outside.x, outside.y);
    await page.mouse.up();
    check('inside text drag does not dismiss', await dialog.isVisible());
    await page.screenshot({ path: `${out}/settings-${width}.png` });
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Places' })
      .getByRole('link', { name: /Catalog/ })
      .click();
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    await page
      .getByRole('navigation', { name: 'Places' })
      .getByRole('link', { name: 'Editor', exact: true })
      .click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    dialog = page.getByRole('dialog', { name: /^Settings:/ });
    check(
      'Catalog shortcuts leave hidden size intact',
      Number(await dialog.getByRole('textbox', { name: 'Width', exact: true }).inputValue()) ===
        before + 50,
    );
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('radio', { name: 'Compose', exact: true }).click();
    const space = page.getByRole('button', { name: /^3 drawers space/ });
    await space.focus();
    await page.keyboard.press('Enter');
    await space.focus();
    await page.keyboard.press('Enter');
    const selectionBefore = await page.locator('.side-body').innerText();
    check(
      'a space editor is selected before opening More',
      (await page.locator('.space-editor').count()) === 1,
    );
    const more = page.locator('summary[aria-label="More"]');
    await more.click();
    await page.screenshot({ path: `${out}/more-${width}.png` });
    await page.keyboard.press('Escape');
    check(
      'Escape on More restores focus',
      await more.evaluate((e) => e === document.activeElement),
    );
    check(
      'Escape on More preserves drawer selection',
      (await page.locator('.side-body').innerText()) === selectionBefore,
    );
    check(
      'no horizontal page scroll',
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    );
    await page.screenshot({ path: `${out}/editor-${width}-light.png` });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: `${out}/editor-${width}-dark.png` });
    await context.close();
  }
  console.log(`${count} production checks passed`);
} finally {
  await browser.close();
}
