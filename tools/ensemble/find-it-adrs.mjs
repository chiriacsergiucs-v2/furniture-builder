// Find-it acceptance for ADR-0050…0059 and ADR-0061 (backlog N46–N55, N57), run against a production build:
//   npm run build && npx vite preview --port 4173 &  node tools/ensemble/find-it-adrs.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `npm test`.
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/'
const out = process.argv[3] ?? 'dist-acceptance'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const results = []
const check = (width, name, ok, detail = '') => { results.push({ width, name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`) }

for (const width of [1440, 375]) {
  const phone = width < 500
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  const wide = () => page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 5).map(e => `${e.tagName}.${e.className}`).join(', '))
  const shot = name => page.screenshot({ path: `${out}/adrs-${name}-${width}.png`, fullPage: true })
  const dlg = page.locator('dialog[open]')
  const pieces = page.locator('ul.pieces > li')
  // Sticky bars can cover a visible control on phones; then the click is sent to the control itself.
  const click = async loc => { await loc.scrollIntoViewIfNeeded(); await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click')) }
  const btn = (name, exact = true) => page.getByRole('button', { name, exact })
  const answer = async (text, label) => { const d = page.locator('dialog.confirm[open]'); await d.locator('input').fill(text); await d.getByRole('button', { name: label }).click(); await d.waitFor({ state: 'detached' }).catch(() => {}) }
  const confirm = async label => { const d = page.locator('dialog.confirm[open]'); await d.getByRole('button', { name: label }).click(); await d.waitFor({ state: 'detached' }).catch(() => {}) }
  const addPiece = async search => {
    await click(btn('Add a piece'))
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search)
    await dlg.locator('.start-group .row-btn').first().click()
    await dlg.waitFor({ state: 'detached' }).catch(() => {})
  }
  const selectPiece = async i => click(pieces.nth(i).getByRole('button').first())
  const field = (label) => page.getByLabel(label, { exact: true }).first()
  const setField = async (label, v) => { const f = field(label); await f.scrollIntoViewIfNeeded(); await f.fill(String(v)); await f.press('Enter'); await page.waitForTimeout(150) }
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ })
  /** Click the plan at room coordinates (mm). */
  const tapPlan = async (x, z) => {
    await plan.scrollIntoViewIfNeeded()
    const pt = await plan.locator('svg').evaluate((svg, [x, z]) => { const m = svg.getScreenCTM(); const p = new DOMPoint(x, z).matrixTransform(m); return { x: p.x, y: p.y } }, [x, z])
    await page.mouse.click(pt.x, pt.y)
    await page.waitForTimeout(150)
  }
  const checksText = async () => { await click(page.getByRole('tab', { name: /Checks/ })); await page.waitForTimeout(200); return page.locator('#panel-checks').innerText() }

  // Project from the bare app.
  await page.goto(url)
  await click(btn('Create a new project'))
  await answer(`ADRs ${width}`, 'Create project')
  await page.locator('main.work').waitFor({ state: 'visible' })

  // ADR-0053: an added piece waits; "Place to the right" or a tap on the plan places it.
  await addPiece('Base cabinet')
  check(width, '0053 banner "Tap the plan to place" after adding', await page.getByText('Tap the plan to place').isVisible())
  await click(btn('Place to the right'))
  await addPiece('Base cabinet')
  await tapPlan(2000, 300)
  check(width, '0053 tapped piece placed at the tapped point (From left ≈ 2000)', Math.abs(Number(await field('From left').inputValue()) - 2000) <= 15, await field('From left').inputValue())
  await setField('From left', 600); await setField('From back', 0)
  await addPiece('Base cabinet')
  await click(btn('Place to the right'))
  check(width, 'three base cabinets in the project', (await pieces.count()) === 3)
  await shot('placed')

  // ADR-0050: project undo/redo with the visible buttons.
  await selectPiece(2)
  await click(page.getByRole('button', { name: 'Remove from project' }))
  await confirm('Remove')
  check(width, '0050 piece removed', (await pieces.count()) === 2)
  await click(btn('Undo'))
  check(width, '0050 Undo brings it back', (await pieces.count()) === 3)
  await click(btn('Redo'))
  check(width, '0050 Redo removes it again', (await pieces.count()) === 2)
  await click(btn('Undo'))

  // ADR-0051/0058: sides on the bottom → run plinth; scribe; automatic refresh after a gap change.
  for (let i = 0; i < 3; i++) {
    await selectPiece(i)
    await click(btn('Edit this piece'))
    await click(page.getByRole('radio', { name: 'Under the sides' }))
    await click(btn('Back to project'))
  }
  await click(btn('Suggest worktop, plinth, fillers and covers'))
  const runList = page.getByRole('region', { name: 'Run parts' })
  check(width, '0051 run parts list a Plinth replacing the pieces\' own', /Plinth[\s\S]*replaces their own plinths/.test(await runList.innerText()))
  await setField('Scribe allowance for fillers', 20)
  await selectPiece(2)
  await setField('Gap to Base cabinet, 1 door on the left', 40)
  const runText = await runList.innerText()
  check(width, '0058 filler appears by itself after the gap change', /Filler[\s\S]*gap 40 mm \+ 20 mm scribe/.test(runText), runText.replace(/\n/g, ' ').slice(0, 200))
  check(width, '0058 "Keep run parts up to date" is on', await page.getByLabel('Keep run parts up to date').isChecked())
  await shot('run-parts')

  // ADR-0052: finish scope.
  await selectPiece(0)
  const finish = page.locator('.finish-fields')
  await finish.scrollIntoViewIfNeeded()
  check(width, '0052 "Finish" heading in the selected piece', await finish.getByRole('heading', { name: 'Finish' }).isVisible())
  const opts = await finish.getByLabel('Board').locator('option').allTextContents()
  await finish.getByLabel('Board').selectOption({ index: opts.length > 1 ? 1 : 0 })
  await click(finish.getByRole('radio', { name: 'This run' }))
  await click(finish.getByRole('button', { name: 'Apply finish' }))
  check(width, '0052 applied to the three pieces of the run', /Applied to 3 pieces/.test(await finish.innerText()), (await finish.innerText()).replace(/\n/g, ' ').slice(-80))

  // ADR-0054: a wardrobe turned to face the run, 300 mm away → cannot open fully (warning, export allowed).
  await addPiece('Wardrobe')
  await click(btn('Place to the right'))
  await click(page.getByRole('radio', { name: '180°' }))
  await setField('From left', 0); await setField('From back', 900)
  const checks1 = await checksText()
  check(width, '0054 Checks list "cannot open fully"', /cannot open fully/.test(checks1))
  check(width, '0054 export stays allowed (Parts CSV enabled)', await btn('Parts CSV').isEnabled())
  await click(page.getByRole('tab', { name: /Parts/ }))

  // ADR-0055: the room with an obstacle the run hits.
  await selectPiece(3)
  await click(page.getByRole('button', { name: 'Remove from project' }))
  await confirm('Remove')
  await click(btn('Add the room'))
  const roomSec = page.getByRole('region', { name: 'Room' })
  check(width, '0055 room added: "Room height" and walls listed', await roomSec.getByRole('textbox', { name: 'Room height', exact: true }).isVisible() && await roomSec.getByRole('textbox', { name: 'Wall 4', exact: true }).isVisible())
  await click(roomSec.getByRole('button', { name: 'Add obstacle' }))
  const checks2 = await checksText()
  check(width, '0055 Checks: base cabinet runs into the obstacle', /runs into Obstacle 1/.test(checks2))
  check(width, '0055 the plan draws the room outline', (await plan.locator('.room-outline .wall').count()) >= 4)
  await click(page.getByRole('tab', { name: /Parts/ }))
  await click(roomSec.getByRole('button', { name: 'Remove obstacle' }))

  // ADR-0056: ready L-shape (six walls), then draw the room by tapping.
  await click(roomSec.getByRole('radio', { name: 'L-shape' }))
  check(width, '0056 L-shape gives six walls', await roomSec.getByRole('textbox', { name: 'Wall 6', exact: true }).isVisible())
  await click(roomSec.getByRole('button', { name: 'Draw the room again' }))
  check(width, '0056 drawing banner visible', await page.getByText('Tap the corners of the room').isVisible())
  for (const [x, z] of [[0, 0], [4200, 0], [4200, 3000], [0, 3000]]) await tapPlan(x, z)
  await click(btn('Close the room'))
  check(width, '0056 drawn room has four walls of the tapped lengths', await roomSec.getByRole('textbox', { name: 'Wall 4', exact: true }).isVisible() && !(await roomSec.getByRole('textbox', { name: 'Wall 5', exact: true }).count()) && Math.abs(Number(await roomSec.getByRole('textbox', { name: 'Wall 1', exact: true }).inputValue()) - 4200) <= 20, await roomSec.getByRole('textbox', { name: 'Wall 1', exact: true }).inputValue())
  await shot('room')

  // ADR-0061 + ADR-0059: Shopping list with my prices.
  await click(page.getByRole('tab', { name: 'Shopping list' }))
  const shop = page.locator('#panel-shopping')
  await shop.getByRole('heading', { name: 'Boards' }).waitFor()
  check(width, '0061 sections Boards, Edge banding, Hardware, Run parts', await shop.getByRole('heading', { name: 'Boards' }).isVisible() && await shop.getByRole('heading', { name: 'Hardware' }).isVisible() && await shop.getByRole('heading', { name: 'Run parts' }).isVisible())
  check(width, '0061 "not counted" line for screws', await shop.getByText(/Screws, dowels, cams and glue are not counted/).isVisible())
  await click(shop.getByRole('button', { name: 'Prices' }))
  await shop.getByLabel(/^Price unit of /).first().selectOption('m2')
  const priceBox = shop.getByLabel(/^Price of /).first()
  await priceBox.fill('250'); await priceBox.press('Tab'); await page.waitForTimeout(200)
  const est = await shop.locator('.estimate').innerText()
  check(width, '0059 estimate shows a total and the missing prices', /Estimate: [1-9][\d\s.,]* lei/.test(est) && /missing/.test(est), est.replace(/\n/g, ' '))
  const [dl] = await Promise.all([page.waitForEvent('download'), click(shop.getByRole('button', { name: 'Shopping list CSV' }))])
  const csv = readFileSync(await dl.path(), 'utf8')
  check(width, '0061 Shopping list CSV downloads with sections', /Plăci/.test(csv) && /Feronerie/.test(csv))
  await shot('shopping')

  // ADR-0057: save as a project template, use it from Home.
  await click(page.getByRole('tab', { name: /Parts/ }))
  await click(btn('Save as project template'))
  await answer(`Template ${width}`, 'Save template')
  await confirm('Cancel').catch(() => {})
  check(width, '0057 saved message', await page.getByText(/Saved as project template/).waitFor({ timeout: 5000 }).then(() => true, () => false))
  await page.getByRole('link', { name: 'Home' }).click()
  await page.getByRole('heading', { name: 'Create from a project template' }).waitFor()
  await click(page.getByRole('button', { name: new RegExp(`Template ${width}`) }))
  await answer(`From template ${width}`, 'Create project')
  await page.locator('main.work').waitFor({ state: 'visible' })
  check(width, '0057 new project from the template has the three pieces', (await pieces.count()) === 3)
  check(width, '0057 run parts suggested again', /Worktop/.test(await page.getByRole('region', { name: 'Run parts' }).innerText()))

  // ADR-0051 sink false front, in a single piece.
  await click(btn('New'))
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Chest of drawers')
  await dlg.locator('.start-group .row-btn').first().click()
  await dlg.waitFor({ state: 'detached' }).catch(() => {})
  await click(page.getByRole('radio', { name: 'Front' }))
  await page.getByRole('button', { name: /drawers space/ }).first().click()
  await click(page.getByLabel('Top drawer is a fixed front (sink false front)'))
  await click(page.getByRole('tab', { name: 'Hardware' }))
  check(width, '0051 fixed front: fixing listed as user-specified', await page.getByText('Fixing for the fixed (false) front').isVisible())
  await click(page.getByRole('tab', { name: 'Shopping list' }))
  check(width, '0061 "To choose before buying" lists the front fixing', await page.locator('#panel-shopping').getByRole('heading', { name: 'To choose before buying' }).isVisible())

  check(width, 'no sideways scroll', await noSideScroll(), await wide())
  check(width, 'no page errors', errors.length === 0, errors.join(' / '))
  await ctx.close()
}
await browser.close()
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
