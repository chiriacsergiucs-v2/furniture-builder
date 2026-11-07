// Production acceptance for ADR-200. IndexedDB failure switches simulate quota failures, never delete test data.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
const url = previewUrl('http://127.0.0.1:4173/furniture-builder/');
const out = outDir('/tmp/furniture-project-acceptance');
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
    const place = async (name) =>
      page
        .getByRole('navigation', { name: 'Places' })
        .getByRole('link', { name, exact: true })
        .click();
    const exported = async (name) => {
      await page.locator('summary[aria-label="More"]').click();
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name }).click();
      const download = await downloading;
      const parts = [];
      for await (const chunk of await download.createReadStream()) parts.push(chunk);
      return JSON.parse(Buffer.concat(parts).toString());
    };
    await page.goto(url);
    await page.getByRole('button', { name: 'New single piece', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Sideboard/ })
      .first()
      .click();
    const design = await exported(/^Design file/);
    const now = new Date().toISOString();
    const project = {
      schemaVersion: schema,
      id: 'project-audit',
      name: 'Project actions',
      createdAt: now,
      updatedAt: now,
      room: {
        height: 2500,
        outline: [
          [0, 0],
          [4000, 0],
          [4000, 3000],
          [0, 3000],
        ],
        features: [],
      },
      items: [
        {
          id: 'audit-piece',
          design,
          quantity: 1,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          placement: { kind: 'floor' },
        },
      ],
    };
    await page.locator('summary[aria-label="More"]').click();
    await page.getByLabel('Import a file', { exact: true }).setInputFiles({
      name: 'project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
    // Keep failure injection at the browser storage boundary: the production error handling remains unchanged.
    await page.evaluate(() => {
      window.failStores = [];
      for (const method of ['put', 'add', 'delete']) {
        const original = IDBObjectStore.prototype[method];
        IDBObjectStore.prototype[method] = function (...args) {
          if (window.failStores.includes(this.name))
            throw new DOMException('Simulated quota failure', 'QuotaExceededError');
          return original.apply(this, args);
        };
      }
    });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    let settings = page.getByRole('dialog', { name: /^Settings:/ });
    await settings.getByRole('button', { name: 'Save as project template', exact: true }).click();
    let form = page.getByRole('dialog', { name: 'Save as project template', exact: true });
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await settings.getByRole('button', { name: 'Done', exact: true }).click();
    await place('Projects');
    await page
      .getByRole('heading', { name: 'Create from a project template', exact: true })
      .waitFor({ state: 'hidden' });
    check(
      'Cancel did not create a template',
      (await page
        .getByRole('heading', { name: 'Create from a project template', exact: true })
        .count()) === 0,
    );
    await place('Editor');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    settings = page.getByRole('dialog', { name: /^Settings:/ });
    await settings.getByRole('button', { name: 'Save as project template', exact: true }).click();
    await page.keyboard.press('Escape');
    await settings.getByRole('button', { name: 'Done', exact: true }).click();
    await place('Projects');
    await page
      .getByRole('heading', { name: 'Create from a project template', exact: true })
      .waitFor({ state: 'hidden' });
    check(
      'Escape did not create a template',
      (await page
        .getByRole('heading', { name: 'Create from a project template', exact: true })
        .count()) === 0,
    );
    await place('Editor');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    settings = page.getByRole('dialog', { name: /^Settings:/ });
    await settings.getByRole('button', { name: 'Save as project template', exact: true }).click();
    form = page.getByRole('dialog', { name: 'Save as project template', exact: true });
    await form
      .getByRole('textbox', { name: 'Name of the project template', exact: true })
      .fill('Reusable room');
    await form.getByRole('checkbox', { name: 'Include the room', exact: true }).uncheck();
    await page.evaluate(() => {
      window.failStores = ['projectTemplates'];
    });
    await form.getByRole('button', { name: 'Save template', exact: true }).click();
    await form.getByRole('alert').waitFor();
    check(
      'failed Save retains name and room choice',
      (await form.getByRole('textbox').inputValue()) === 'Reusable room' &&
        !(await form.getByRole('checkbox').isChecked()),
    );
    await page.screenshot({ path: `${out}/save-failure-${width}.png` });
    await page.evaluate(() => {
      window.failStores = [];
    });
    await form.getByRole('button', { name: 'Save template', exact: true }).click();
    await settings.getByText(/Saved as project template/).waitFor();
    await settings.getByRole('button', { name: 'Done', exact: true }).click();
    // History writes fail visibly and remain retryable.
    await sheet();
    await page
      .locator('.side-body summary')
      .filter({ hasText: /^History/ })
      .click();
    await page.evaluate(() => {
      window.failStores = ['projectVersions'];
    });
    await page.getByRole('button', { name: 'Save a version', exact: true }).click();
    await page
      .getByText('The version could not be saved on this device.', { exact: true })
      .waitFor();
    check(
      'version failure has no false success',
      (await page.getByText('Version saved.', { exact: true }).count()) === 0,
    );
    await page.screenshot({ path: `${out}/version-failure-${width}.png` });
    await page.evaluate(() => {
      window.failStores = [];
    });
    await page.getByRole('button', { name: 'Save a version', exact: true }).click();
    await page.getByText('Version saved.', { exact: true }).waitFor();
    check(
      'version retry succeeds',
      (await page.getByRole('button', { name: 'Restore', exact: true }).count()) === 1,
    );
    // A real picture preparation is paused while the user edits the room.
    await page.locator('.room-fold > summary').click();
    await page
      .getByRole('combobox', { name: 'Wall 1 background', exact: true })
      .selectOption('picture');
    await page.evaluate(() => {
      const original = window.createImageBitmap.bind(window);
      window.createImageBitmap = (...args) =>
        new Promise((resolve, reject) => {
          window.releasePicture = () => original(...args).then(resolve, reject);
        });
    });
    const png = Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        const c = canvas.getContext('2d');
        c.fillStyle = '#345678';
        c.fillRect(0, 0, 2, 2);
        return canvas.toDataURL('image/png').split(',')[1];
      }),
      'base64',
    );
    await page
      .getByLabel('Add a picture for Wall 1', { exact: true })
      .setInputFiles({ name: 'wall.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('textbox', { name: 'Room height', exact: true }).fill('2800');
    await page.getByRole('textbox', { name: 'Room height', exact: true }).press('Enter');
    await page.evaluate(() => window.releasePicture());
    await page
      .getByLabel('Replace picture for Wall 1', { exact: true })
      .waitFor({ state: 'attached' });
    let saved = await exported(/^Project file/);
    check(
      'picture completion preserves edited room height',
      saved.room.height === 2800 && !!saved.room.walls?.[0].image,
    );
    await page
      .getByLabel('Replace picture for Wall 1', { exact: true })
      .setInputFiles({ name: 'stale.png', mimeType: 'image/png', buffer: png });
    await page
      .getByRole('combobox', { name: 'Wall 1 background', exact: true })
      .selectOption('none');
    await page.evaluate(() => window.releasePicture());
    await page
      .getByText('The prepared picture was not applied because its wall or background changed.', {
        exact: true,
      })
      .waitFor();
    saved = await exported(/^Project file/);
    check('changed background rejects delayed picture', !saved.room.walls?.length);
    await place(/Catalog/);
    await page.getByRole('tab', { name: 'Saved on this device', exact: true }).click();
    const templates = page.locator('.project-templates');
    await templates.getByRole('button', { name: 'Rename', exact: true }).click();
    form = page.getByRole('dialog', { name: 'Rename', exact: true });
    await form.getByRole('textbox', { name: 'New name', exact: true }).fill('Renamed template');
    await page.evaluate(() => {
      window.failStores = ['projectTemplates'];
    });
    await form.getByRole('button', { name: 'Rename', exact: true }).click();
    await form.getByRole('alert').waitFor();
    check(
      'rename failure keeps input',
      (await form.getByRole('textbox').inputValue()) === 'Renamed template',
    );
    await page.evaluate(() => {
      window.failStores = [];
    });
    await form.getByRole('button', { name: 'Rename', exact: true }).click();
    await templates.getByRole('button', { name: /^Renamed template/ }).waitFor();
    await templates.getByRole('button', { name: /^Renamed template/ }).click();
    form = page.getByRole('dialog', { name: 'Create project', exact: true });
    await form
      .getByRole('textbox', { name: 'Name of the new project', exact: true })
      .fill('Created copy');
    await page.evaluate(() => {
      window.failStores = ['projects'];
    });
    await form.getByRole('button', { name: 'Create project', exact: true }).click();
    await form.getByRole('alert').waitFor();
    check(
      'create failure keeps input',
      (await form.getByRole('textbox').inputValue()) === 'Created copy',
    );
    await page.screenshot({ path: `${out}/create-failure-${width}.png` });
    await page.evaluate(() => {
      window.failStores = [];
    });
    await form.getByRole('button', { name: 'Create project', exact: true }).click();
    await form.waitFor({ state: 'hidden' });
    saved = await exported(/^Project file/);
    check(
      'created copy uses name and excludes unchecked room',
      saved.name === 'Created copy' && !saved.room && saved.items.length === 1,
    );
    check(
      'no horizontal page scroll',
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    );
    await page.screenshot({ path: `${out}/project-${width}-light.png` });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: `${out}/project-${width}-dark.png` });
    await context.close();
  }
  console.log(`${count} production checks passed`);
} finally {
  await browser.close();
}
