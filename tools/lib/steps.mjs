// Shared steps for the browser find-it scripts (`tools/*/find-it*.mjs`, cleanup audit 2026-11-09 item 10a), so a UI
// change updates one place instead of every script that walks through it.

/**
 * Show the results (ADR-241): the Build & Preview mode on a desktop, the Cut list place in the bottom nav on a phone
 * (the mode row is hidden there).
 */
export async function goBuild(page) {
  const radio = page.getByRole('radio', { name: /Build & Preview/ });
  if (await radio.isVisible().catch(() => false)) return radio.click();
  await page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: /Cut list/ })
    .click();
}

/** Back to the drawing: the Compose mode on a desktop, the Editor place on a phone (ADR-241). */
export async function goCompose(page) {
  const radio = page.getByRole('radio', { name: 'Compose', exact: true });
  if (await radio.isVisible().catch(() => false)) return radio.click();
  await page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: 'Editor' })
    .click();
}

/**
 * Open the selected project piece in the piece editor screen (ADR-241: Edit this piece now edits in the project;
 * the screen is under More actions). `scope` is the selected-piece card, or the page.
 */
export async function openPieceEditor(page, scope = page) {
  const card = scope.getByRole('region', { name: /^Selected piece: / }).first();
  const where = (await card.count()) ? card : scope;
  await where.getByRole('button', { name: 'More actions' }).first().click();
  await page.getByRole('button', { name: 'Open in the piece editor' }).click();
}

/**
 * Show the project's piece list (`ul.pieces`): with a piece selected the panel shows that piece, and its All pieces
 * button goes back to the list (and clears the selection, ADR-160). `scope` is the project panel, or the page.
 */
export async function showPieces(page, scope = page) {
  // A phone's list is in the bottom sheet: open it first.
  const peek = page.locator('.sheet-peek');
  if (
    (await peek.isVisible().catch(() => false)) &&
    (await peek.getAttribute('aria-expanded')) === 'false'
  )
    await peek.click();
  const all = scope.getByRole('button', { name: /^All pieces/ }).first();
  if (await all.isVisible().catch(() => false)) await all.click();
  await scope
    .locator('ul.pieces')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => {});
}

/**
 * Show a results tab (Parts, Sheets, …). A click on the tab already open closes the results (toggleTab), and the
 * phone's Cut list place opens them on the Parts tab, so the tab is clicked only when its panel is not showing.
 */
export async function openTab(page, name) {
  const tab = page.getByRole('tab', { name }).first();
  const id = await tab.getAttribute('aria-controls');
  const panel = id ? page.locator(`[id="${id}"]`) : null;
  if (
    (await tab.getAttribute('aria-selected')) === 'true' &&
    panel &&
    (await panel.isVisible().catch(() => false))
  )
    return;
  await tab.click();
}
