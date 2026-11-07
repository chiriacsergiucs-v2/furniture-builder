// Production acceptance for ADR-199: start from the bare app and use visible controls at both widths.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
const url = previewUrl('http://127.0.0.1:4173/furniture-builder/');
const out = outDir('/tmp/furniture-piece-editor-acceptance');
mkdirSync(out, { recursive: true });
const schema = Number(
  /PROJECT_SCHEMA = (\d+)/.exec(readFileSync('src/core/project.ts', 'utf8'))[1],
);
const browser = await launchBrowser({
  args: process.env.CHROMIUM_PATH
    ? ['--disable-gpu', '--disable-software-rasterizer', '--use-gl=disabled']
    : [],
});
let count = 0;
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const check = (name, ok) => {
      if (!ok) throw Error(`${width}px ${name}`);
      console.log(`PASS ${width}px ${name}`);
      count++;
    };
    const sheet = async () => {
      const peek = page.locator('.sheet-peek');
      if (width === 390 && (await peek.getAttribute('aria-expanded')) === 'false')
        await peek.click();
    };
    await page.goto(url);
    await page.getByRole('button', { name: 'New single piece', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Sideboard/ })
      .first()
      .click();
    await page.getByRole('radio', { name: 'Compose', exact: true }).click();
    await sheet();
    await page.getByRole('button', { name: /Edit the interior/ }).click();
    const share = page.getByRole('textbox', { name: 'Left share', exact: true });
    const original = await share.inputValue();
    await share.fill('abc');
    await share.press('Tab');
    check(
      'invalid share is retained and explained',
      (await share.getAttribute('aria-invalid')) === 'true' &&
        (await page
          .getByText('Enter a finite share greater than 0 and less than 1000.', { exact: true })
          .isVisible()),
    );
    await page.screenshot({ path: `${out}/split-invalid-${width}.png` });
    await share.focus();
    await share.press('Escape');
    check('Escape restores share', (await share.inputValue()) === original);
    await share.fill('2');
    await share.press('Enter');
    check('Enter commits share', (await share.inputValue()) === '2');
    await page.getByRole('button', { name: 'Middle', exact: true }).click();
    await page.getByRole('radio', { name: 'Choose', exact: true }).click();
    await page.getByRole('combobox', { name: 'Drawer 1 sizing', exact: true }).selectOption('mm');
    const mm = page.getByRole('textbox', { name: 'Drawer 1 front height in mm', exact: true });
    await mm.fill('1.5');
    await mm.press('Tab');
    check(
      'drawer whole-mm validation',
      (await mm.getAttribute('aria-invalid')) === 'true' &&
        (await page
          .getByText('Enter a positive whole number of millimetres.', { exact: true })
          .isVisible()),
    );
    await page.screenshot({ path: `${out}/drawer-invalid-${width}.png` });
    await mm.fill('200');
    await mm.press('Enter');
    await page
      .getByRole('button', { name: 'Select the divided space around this one', exact: true })
      .click();
    await page.getByRole('button', { name: 'Left', exact: true }).click();
    await page.getByRole('radio', { name: 'Right', exact: true }).click();
    await page.getByRole('radio', { name: 'Pair', exact: true }).click();
    await page.getByRole('radio', { name: 'Door', exact: true }).click();
    check(
      'Door/Pair retains right hinge',
      (await page
        .getByRole('radio', { name: 'Right', exact: true })
        .getAttribute('aria-checked')) === 'true',
    );
    check(
      'no horizontal page scroll with validation',
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    );
    await page.locator('summary[aria-label="More"]').click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Design file/ }).click();
    const download = await downloading;
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const design = JSON.parse(Buffer.concat(chunks).toString());
    const now = new Date().toISOString();
    const project = {
      schemaVersion: schema,
      id: 'locktest',
      name: 'Locked width',
      createdAt: now,
      updatedAt: now,
      items: [
        {
          id: 'itemlock',
          design,
          quantity: 1,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          placement: { kind: 'floor' },
          sizeLocks: ['width'],
        },
      ],
    };
    await page.locator('summary[aria-label="More"]').click();
    await page.getByLabel('Import a file', { exact: true }).setInputFiles({
      name: 'locked.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
    await sheet();
    await page
      .getByRole('list', { name: 'Pieces', exact: true })
      .getByRole('button', { name: /Sideboard/ })
      .click();
    await sheet();
    await page.getByRole('button', { name: 'Edit this piece', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /^Settings:/ });
    check(
      'Settings disables only the locked width',
      (await dialog.getByRole('textbox', { name: 'Width', exact: true }).isDisabled()) &&
        (await dialog.getByRole('textbox', { name: 'Height', exact: true }).isEnabled()),
    );
    check(
      'Settings explains the lock',
      await dialog
        .getByText(/width locked — unlock to change/)
        .first()
        .isVisible(),
    );
    await page.screenshot({ path: `${out}/locked-settings-${width}.png` });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: `${out}/locked-settings-${width}-dark.png` });
    await context.close();
  }
  console.log(`${count} production checks passed`);
} finally {
  await browser.close();
}
