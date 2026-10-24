// Find-it acceptance for the Feature Research & Catalog page (AGENTS.md R3), run against a production build:
//   npm run build && npx vite preview --port 4173 &  node tools/research/find-it.mjs http://localhost:4173/furniture-builder/
// Starts from the bare app at each width and finds everything by visible text. Not part of `npm test`.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/'
const out = process.argv[3] ?? 'dist-acceptance'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const results = []
const check = (width, name, ok, detail = '') => { results.push({ width, name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`) }

for (const width of [1440, 1024, 390, 360]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 800 : 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  const noSideScroll = async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  await page.goto(url)
  const tab = page.getByRole('link', { name: /Feature Research/ })
  check(width, 'visible "Feature Research" tab in the top bar', await tab.isVisible())
  await tab.click()
  check(width, 'page heading "Feature Research & Catalog"', await page.getByRole('heading', { name: 'Feature Research & Catalog' }).isVisible())
  check(width, 'overview shows sub-feature and unreviewed-finding totals', await page.getByText('Sub-features', { exact: true }).isVisible() && await page.getByText('Unreviewed findings').isVisible())
  check(width, 'no sideways scroll on the overview', await noSideScroll())
  check(width, 'assessment dashboard: matrix, distributions, quick wins', await page.getByRole('heading', { name: 'Assessment: demand, value, complexity, confidence' }).isVisible()
    && await page.getByText('Value (rows) × complexity (columns)').isVisible() && await page.getByRole('heading', { name: /Quick wins/ }).isVisible())
  check(width, 'research priority distribution on the dashboard', await page.getByRole('heading', { name: 'Research priority' }).isVisible() && await page.getByRole('button', { name: 'P0 foundational' }).isVisible())
  await page.getByRole('button', { name: /features with value 4\.5–5\.0 and Low complexity/ }).click()
  check(width, 'matrix cell opens the matching features', await page.locator('table.features-table tbody tr').count() >= 1 && await page.getByLabel('Value', { exact: true }).inputValue() === '4.5')
  await page.getByRole('tab', { name: 'Overview' }).click()
  await page.screenshot({ path: `${out}/research-overview-${width}.png`, fullPage: false })

  await page.getByRole('tab', { name: 'Features' }).click()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  const rows = await page.locator('table.features-table tbody tr').count()
  check(width, 'every feature listed (≥ 150 rows)', rows >= 150, `${rows} rows`)
  await page.getByLabel('Search features').fill('disable snapping')
  check(width, 'search finds the snap override', await page.getByRole('button', { name: 'Snap override (modifier key or toggle)' }).isVisible())
  await page.getByLabel('Search features').fill('')
  const sel = page.getByLabel('Your decision on Automatically generated shared countertops/worktops')
  await sel.selectOption('shortlisted')
  check(width, 'no sideways scroll on the feature list', await noSideScroll())
  await page.screenshot({ path: `${out}/research-features-${width}.png`, fullPage: false })

  await page.getByRole('button', { name: 'Guided connection snapping with live preview and orientation' }).first().click()
  check(width, 'detail shows sub-features and evidence', await page.getByRole('heading', { name: /Sub-features/ }).isVisible() && await page.getByRole('heading', { name: /Research evidence/ }).isVisible())
  await page.getByLabel('Your notes').fill(`note at ${width}`)
  await page.getByRole('combobox', { name: 'Your decision', exact: true }).selectOption('approved')
  await page.getByLabel('Your notes').blur()
  check(width, 'no sideways scroll on the feature detail', await noSideScroll())
  await page.screenshot({ path: `${out}/research-detail-${width}.png`, fullPage: false })
  await page.waitForTimeout(300)

  await page.reload()
  await page.goto(`${url}#research`)
  await page.getByRole('tab', { name: 'Features' }).click()
  check(width, 'decision kept after reload', await page.getByLabel('Your decision on Automatically generated shared countertops/worktops').inputValue() === 'shortlisted')
  await page.getByLabel('Shortlisted and approved only').check()
  const planned = await page.locator('table.features-table tbody tr').count()
  check(width, 'shortlisted + approved filter', planned === 2, `${planned} rows`)
  await page.getByRole('button', { name: 'Guided connection snapping with live preview and orientation' }).first().click()
  check(width, 'notes kept after reload', await page.getByLabel('Your notes').inputValue() === `note at ${width}`)

  await page.getByRole('tab', { name: 'Coverage audit' }).click()
  check(width, 'coverage audit says complete', await page.getByText(/Extraction complete/).isVisible())
  await page.getByRole('tab', { name: 'Import & export' }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Specification of shortlisted \+ approved \(2\)/ }).click()])
  check(width, 'specification export downloads', dl.suggestedFilename().endsWith('.md'), dl.suggestedFilename())
  for (const t of ['Compare', 'Findings', 'Competitors', 'Contradictions', 'Sources']) {
    await page.getByRole('tab', { name: t }).click()
    check(width, `"${t}" opens without sideways scroll`, await noSideScroll())
  }
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}
await browser.close()
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
