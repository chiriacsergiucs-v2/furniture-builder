// Find-it acceptance for the New-piece wizard (CLAUDE.md R3, ADR-044–046), run against a production build:
//   npm run build && npx vite preview --port 4173 &  node tools/wizard/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `npm test`.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/'
const out = process.argv[3] ?? 'dist-acceptance'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const results = []
const check = (width, name, ok, detail = '') => { results.push({ width, name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`) }

const TYPES = [
  { label: 'Cabinet (closed box)', width: 1000 },
  { label: 'Open shelving', width: 900 },
  { label: 'Table (leg frame)', width: 1400 },
  { label: 'Bench (leg frame)', width: 1100 },
  { label: 'Desk', width: 1500 },
  { label: 'Wardrobe', width: 1200 },
  { label: 'Bed', width: 1600 },
]

for (const width of [1440, 375]) {
  const phone = width < 500
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  const wizard = page.locator('dialog[open]')
  const cardLabels = () => wizard.locator('.wz-card-label').allInnerTexts()
  /** A step in the wizard's steps rail, by its visible label. */
  const rail = label => wizard.locator('.steps .lbl').getByText(label, { exact: true })
  const shot = name => page.screenshot({ path: `${out}/wizard-${name}-${width}.png` })
  await page.goto(url)
  // The app starts on Home (N38); the editor is one visible tab away.
  await page.getByRole('link', { name: 'Editor' }).click()

  /** Open the wizard by visible text: desktop through New → "New piece, step by step"; phones through the Catalog tab → "New piece". */
  const openWizard = async (via) => {
    if (via === 'new') {
      await page.getByRole('button', { name: 'New', exact: true }).click()
      await page.getByText('New piece, step by step').click()
    } else {
      await page.getByRole('link', { name: /Catalog/ }).click()
      await page.getByRole('button', { name: 'New piece', exact: true }).click()
    }
    return wizard.getByRole('heading', { name: 'New piece' }).isVisible()
  }

  for (const [n, t] of TYPES.entries()) {
    const via = phone || n % 2 ? 'catalog' : 'new'
    if (!phone && via === 'new') check(width, 'visible text "New" in the top bar', await page.getByRole('button', { name: 'New', exact: true }).getByText('New').isVisible())
    if (via === 'catalog') check(width, 'visible "Catalog" tab and "New piece" on the Catalog page', await page.getByRole('link', { name: /Catalog/ }).isVisible())
    check(width, `${t.label}: wizard opens (${via === 'new' ? 'New → New piece, step by step' : 'Catalog → New piece'})`, await openWizard(via))
    const name = `Find-it ${t.label.split(' ')[0]} ${width}`
    await wizard.getByLabel('Name').fill(name)
    await wizard.getByLabel(/^Width/).fill(String(t.width))
    await wizard.getByLabel(/^Width/).blur()
    if (n === 0) await shot('1-size')
    await wizard.getByRole('button', { name: 'Next' }).click()
    await wizard.getByRole('button', { name: new RegExp(t.label.replace(/[()]/g, '\\$&')) }).click()
    await page.waitForTimeout(150)
    const cards = await cardLabels()
    check(width, `${t.label}: suggestion cards after choosing the type`, cards.length >= 4, `${cards.length} cards: ${cards.slice(0, 6).join(' / ')}`)
    if (n === 0) await shot('2-type-cards')

    if (n === 0 || n === 2) {
      // U7: cards vary, and sizes change which cards are offered.
      const more = async () => { while (await wizard.getByRole('button', { name: /Show more/ }).isVisible()) await wizard.getByRole('button', { name: /Show more/ }).click() }
      await more()
      const before = new Set(await cardLabels())
      const all = cards.join(' / ')
      if (n === 0) check(width, 'cabinet cards mix shelves / drawers / doors / no doors', ['shel', 'drawer', 'door', 'no doors'].every(w => all.includes(w)))
      else check(width, 'table cards mix tops / stretchers / lower shelf', ['panel top', 'slatted top', 'stretchers', 'lower shelf'].every(w => all.includes(w)))
      await rail('Size').click()
      await wizard.getByLabel(/^Height/).fill(n === 0 ? '350' : '300')
      await wizard.getByLabel(/^Height/).blur()
      await rail('Type').click()
      await page.waitForTimeout(150)
      await more()
      const lowAll = await cardLabels()
      const gone = [...before].filter(l => !lowAll.includes(l))
      check(width, `${t.label}: changing the height changes the cards`, gone.length > 0 || lowAll.some(l => !before.has(l)),
        `${before.size} cards → ${lowAll.length}; no longer offered e.g. "${gone[0] ?? '—'}"`)
      if (n === 0) check(width, 'cabinet 350 mm high offers no 5- or 6-drawer card', !lowAll.some(l => /\b[56] drawers/.test(l)))
      await rail('Size').click()
      await wizard.getByLabel(/^Height/).fill(n === 0 ? '900' : '750')
      await wizard.getByLabel(/^Height/).blur()
      await rail('Type').click()
      await page.waitForTimeout(150)
      // "Use this" fills the wizard.
      const pick = wizard.locator('.wz-card').filter({ hasText: n === 0 ? /drawer/ : /slatted top/ }).first()
      const picked = await pick.locator('.wz-card-label').innerText()
      await pick.getByRole('button', { name: 'Use this' }).click()
      const at = await wizard.locator('.steps [aria-current="step"] .lbl').innerText()
      check(width, `${t.label}: "Use this" moves on to the next open step`, at !== 'Type', `"${picked}" → ${at}`)
      if (n === 0) {
        await rail('Contents').click()
        const kinds = await wizard.locator('select').evaluateAll(s => s.map(x => x.value))
        check(width, 'cabinet card filled the contents step', kinds.some(k => k.includes('drawers')), kinds.join(', '))
        await shot('3-contents')
        await rail('Doors').click()
        const later = await cardLabels()
        check(width, 'cards on a later step (Doors)', later.length >= 2, later.slice(0, 4).join(' / '))
        await shot('4-doors-cards')
      } else {
        await rail('Frame').click()
        check(width, 'table card filled the frame step', await wizard.getByRole('radio', { name: 'Slats' }).getAttribute('aria-checked') === 'true')
      }
    } else {
      await wizard.getByRole('button', { name: 'Start blank' }).click()
    }

    // Walk to Review with Next.
    for (let k = 0; k < 8 && !(await wizard.getByRole('button', { name: 'Create piece' }).isVisible()); k++) await wizard.getByRole('button', { name: 'Next' }).click()
    check(width, `${t.label}: Review shows parts and checks`, await wizard.getByRole('region', { name: 'Parts' }).isVisible() && await wizard.getByRole('region', { name: 'Problems' }).isVisible())
    check(width, `${t.label}: no sideways scroll in the wizard`, await noSideScroll())
    if (n === 0) {
      await shot('5-review')
      // Validation: an impossible size blocks "Create piece" with a visible problem.
      await rail('Size').click()
      await wizard.getByLabel(/^Depth/).fill('50')
      await wizard.getByLabel(/^Depth/).blur()
      check(width, 'out-of-range depth shows a problem on the step', await wizard.getByText(/Depth must be a whole number from 150 to 900 mm/).first().isVisible())
      await rail('Review').click()
      check(width, 'error blocks "Create piece"', await wizard.getByRole('button', { name: 'Create piece' }).isDisabled())
      await rail('Size').click()
      await wizard.getByLabel(/^Depth/).fill('450')
      await wizard.getByLabel(/^Depth/).blur()
      await rail('Review').click()
    }
    await wizard.getByRole('button', { name: 'Create piece' }).click()
    await page.waitForTimeout(400)
    check(width, `${t.label}: created and opened in the editor`, await page.getByLabel('Name of this piece').inputValue() === name && !(await wizard.count()))

    // In the catalog, and it opens in the editor.
    await page.getByRole('link', { name: /Catalog/ }).click()
    await page.getByRole('tab', { name: 'Saved on this device' }).click()
    const item = page.getByRole('button', { name: new RegExp(name) })
    check(width, `${t.label}: listed in Catalog → Saved on this device`, await item.waitFor({ timeout: 5000 }).then(() => true, () => false))
    if (n === 0) await shot('6-catalog-saved')
    await item.click()
    check(width, `${t.label}: opens from the catalog in the editor`, await page.getByLabel('Name of this piece').inputValue() === name)
    if (n === 0) await shot('7-editor')
  }
  // N35: reopen a wizard piece; an editor change is announced and replaced; the piece is updated in place.
  const cabName = `Find-it Cabinet ${width}`
  await page.getByRole('link', { name: /Catalog/ }).click()
  await page.getByRole('tab', { name: 'Saved on this device' }).click()
  await page.getByRole('button', { name: new RegExp(cabName) }).click()
  const side = page.locator('aside.side')
  await side.getByLabel('Width', { exact: true }).fill('1100')
  await side.getByLabel('Width', { exact: true }).press('Enter')
  await page.waitForTimeout(600)
  const reopen = page.getByRole('button', { name: 'Open in wizard' })
  check(width, 'visible "Open in wizard" on a wizard piece', await reopen.isVisible())
  await reopen.click()
  check(width, 'wizard reopens with the piece name in its title', await wizard.getByRole('heading', { name: `Wizard: ${cabName}` }).isVisible())
  check(width, 'reopened wizard warns that editor changes will be replaced', await wizard.getByText(/changed in the editor since/).isVisible())
  check(width, 'reopened wizard holds the stored answers (width 1000)', await wizard.getByLabel(/^Width/).inputValue() === '1000')
  if (width > 500) await shot('8-reopen')
  await rail('Dividers').click()
  await wizard.getByRole('button', { name: 'More vertical dividers' }).click()
  await rail('Review').click()
  await wizard.getByRole('button', { name: 'Update piece' }).click()
  await page.waitForTimeout(500)
  check(width, '"Update piece" keeps the piece and its name', await page.getByLabel('Name of this piece').inputValue() === cabName && await side.getByLabel('Width', { exact: true }).inputValue() === '1000')
  await page.getByRole('link', { name: /Catalog/ }).click()
  await page.getByRole('tab', { name: 'Saved on this device' }).click()
  await page.getByRole('button', { name: new RegExp(cabName) }).first().waitFor({ timeout: 5000 }).catch(() => {})
  check(width, 'updated in place, not duplicated in the catalog', await page.getByRole('button', { name: new RegExp(cabName) }).count() === 1)

  // N36: pictures in Start from, and drawn in the browser for an edited family.
  await page.getByRole('link', { name: /Editor/ }).click()
  await page.getByRole('button', { name: 'New', exact: true }).click()
  const thumbs = page.locator('dialog[open] .start-from img.thumb')
  await page.waitForTimeout(500)
  const loaded = await thumbs.evaluateAll(imgs => imgs.slice(0, 6).filter(i => i.complete && i.naturalWidth > 0).length)
  check(width, 'pictures on the Start from rows', await thumbs.count() >= 90 && loaded >= 4, `${await thumbs.count()} rows with a picture, first 6: ${loaded} loaded`)
  if (width > 500) await shot('9-start-from')
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: /Catalog/ }).click()
  await page.getByRole('tab', { name: 'Templates' }).click()
  const fam = page.locator('article.family').first()
  const famName = await fam.locator('h3').evaluate(h => h.firstChild.textContent.trim())
  await fam.getByRole('button', { name: 'Edit template' }).click()
  await page.getByRole('button', { name: 'Save template' }).click()
  await page.waitForTimeout(500)
  const edited = page.locator('article.family').filter({ has: page.locator('.chip.edited') }).first()
  const src = await edited.locator('img.snap').first().getAttribute('src')
  check(width, `edited family "${famName}" shows a picture drawn in the browser`, !!src && src.startsWith('data:image/svg+xml'))
  if (width > 500) await edited.screenshot({ path: `${out}/wizard-10-edited-family-${width}.png` })
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}
await browser.close()
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
