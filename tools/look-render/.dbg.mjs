import { chromium } from 'playwright';
const log = (...a) => process.stderr.write(a.join(' ')+'\n');
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1280,height:900}}); const page = await ctx.newPage();
page.setDefaultTimeout(90000);
page.on('pageerror', e=>log('pageerror', e.message));
await page.goto('http://localhost:4173/furniture-builder/');
await page.getByRole('button', { name: 'New single piece' }).click();
const dlg = page.locator('dialog[open]');
await dlg.locator('.start-group .row-btn').first().click();
await page.locator('main.work').waitFor();
await page.getByRole('radio', { name: '3D' }).click();
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Render' }).click();
await dlg.getByRole('radio', { name: '1280 × 720' }).click();
await dlg.getByRole('button', { name: 'Start' }).click();
log('started', new Date().toISOString());
for (let i=0;i<100;i++){ await page.waitForTimeout(2000); const t = (await dlg.locator('[role=status],[role=alert]').allInnerTexts()).join('|'); log(i, new Date().toISOString().slice(11,19), t); if (/Could not|Done/.test(t)) break; }
await b.close();
