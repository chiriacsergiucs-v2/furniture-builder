/**
 * Button labels never wrap; a label too long for its box ends in an ellipsis (ADR-112). This gives such a button its
 * full text in `title` when the pointer or the keyboard reaches it, and takes the title away again once the label
 * fits. Buttons with their own `title` are left alone; the accessible name never changes (it comes from the text).
 */
const CONTROL = 'button, [role="tab"], .btn';

/** True when the element or one of its label spans is cut by its own box. */
export function isCut(el: HTMLElement): boolean {
  return [el, ...el.querySelectorAll<HTMLElement>('span')].some(
    (x) => x.scrollWidth > x.clientWidth + 1,
  );
}

/** Set or clear the automatic title of one control. */
export function syncCutTitle(el: HTMLElement): void {
  const auto = el.dataset.cutTitle !== undefined;
  if (el.hasAttribute('title') && !auto) return;
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text && isCut(el)) {
    el.title = text;
    el.dataset.cutTitle = '';
  } else if (auto) {
    el.removeAttribute('title');
    delete el.dataset.cutTitle;
  }
}

/** Listen on the whole document; returns a function that stops listening. */
export function installCutTitles(doc: Document = document): () => void {
  const onEvent = (e: Event) => {
    const t = e.target;
    const el = t instanceof Element ? t.closest(CONTROL) : null;
    if (el instanceof HTMLElement) syncCutTitle(el);
  };
  doc.addEventListener('pointerover', onEvent, true);
  doc.addEventListener('focusin', onEvent, true);
  return () => {
    doc.removeEventListener('pointerover', onEvent, true);
    doc.removeEventListener('focusin', onEvent, true);
  };
}
