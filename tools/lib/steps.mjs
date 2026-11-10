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
