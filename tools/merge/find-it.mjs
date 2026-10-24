// Find-it acceptance for merging two pieces of a project (CLAUDE.md R3, backlog N42), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/merge/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/'
const out = process.argv[3] ?? 'dist-acceptance'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const results = []
const check = (width, name, ok, detail = '') => { results.push({ width, name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`) }

for (const width of [1440, 375]) {
  const phone = width < 500
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  const shot = name => page.screenshot({ path: `${out}/merge-${name}-${width}.png`, fullPage: true })
  const pieces = page.locator('ul.pieces > li')
  const addPiece = async (search, name) => {
    await page.getByRole('button', { name: 'Add a piece' }).dispatchEvent('click')
    const dlg = page.locator('dialog[open]')
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search)
    await dlg.getByRole('button', { name }).first().click()
    await dlg.waitFor({ state: 'detached' }).catch(() => {})
  }

  // 1. Bare app → Home → create a project with two base cabinets side by side.
  await page.goto(url)
  await page.getByRole('button', { name: 'Create a new project' }).click()
  await page.locator('dialog[open] input').fill('Merge test')
  await page.locator('dialog[open]').getByRole('button', { name: 'Create project' }).click()
  await page.locator('main.work').waitFor({ state: 'visible' })
  await addPiece('Base cabinet', /Base cabinet, doors: 1 door \+ shelf/)
  await addPiece('Base cabinet', /Base cabinet, doors: Drawer over door/)
  check(width, 'two pieces in the project', (await pieces.count()) === 2)

  // 2. Select the first; the merge control is found by its visible text.
  await pieces.nth(0).getByRole('button').dispatchEvent('click')
  check(width, '"Merge into one piece" heading visible', await page.getByRole('heading', { name: 'Merge into one piece' }).isVisible())
  const btn = page.getByRole('button', { name: /^Merge with Base cabinet, drawer over door on the right$/ })
  await btn.scrollIntoViewIfNeeded()
  check(width, '"Merge with … on the right" button enabled', await btn.isVisible() && await btn.isEnabled())
  check(width, 'no sideways scroll (before)', await noSideScroll())
  await shot('before')

  // 3. Merge after the confirmation: one piece, 1200 wide, with both names; no problems.
  await btn.dispatchEvent('click')
  await page.locator('dialog[open]').getByRole('button', { name: 'Merge', exact: true }).click()
  await page.waitForTimeout(300)
  const rowText = (await pieces.allInnerTexts()).join(' | ')
  check(width, 'one piece after merging', (await pieces.count()) === 1, rowText)
  check(width, 'merged piece named after both and 1200 mm wide', /Base cabinet, 1 door \+ Base cabinet, drawer over door/.test(rowText) && /1200 ×/.test(rowText))
  check(width, 'merged piece is selected', await page.getByRole('region', { name: /Selected piece: Base cabinet, 1 door \+/ }).isVisible())
  await shot('after')

  // 4. Open it in the editor: one cabinet, three uprights (two sides + one divider) in the parts.
  await page.getByRole('button', { name: 'Edit this piece' }).dispatchEvent('click')
  await page.getByRole('tab', { name: /Parts/ }).dispatchEvent('click')
  await page.waitForTimeout(300)
  const parts = await page.locator('#panel-parts').innerText()
  check(width, 'editor parts list the divider of the merged cabinet', /Divider/.test(parts) && /\t1200\t720\t/.test(parts.replace(/\n/g, '\t')))
  await page.getByRole('button', { name: 'Back to project' }).dispatchEvent('click')
  await page.waitForTimeout(300)

  // 5. A taller piece next to it cannot be merged; the reason is shown and the button is disabled.
  await addPiece('chest of drawers', /Chest of drawers/)
  await pieces.nth(1).getByRole('button').dispatchEvent('click')
  const no = page.getByRole('button', { name: /^Merge with Base cabinet, 1 door \+ Base cabinet, drawer over door on the left$/ })
  await no.scrollIntoViewIfNeeded()
  check(width, 'different piece: merge button disabled', await no.isVisible() && await no.isDisabled())
  check(width, 'different piece: reason shown', await page.getByText(/Different height/).first().isVisible())
  check(width, 'no sideways scroll (refused)', await noSideScroll())
  await shot('refused')
  check(width, 'no page errors', errors.length === 0, errors.join(' / '))
  await ctx.close()
}
await browser.close()
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
