// The element map the capture scripts save beside each screenshot (N295, N314): landmarks, headings and interactive
// elements with their boxes. `mapPage` runs inside the page (`page.evaluate(mapPage)`), so it uses nothing from this file.

/** Runs in the page: every landmark, heading and interactive element with its box. */
export function mapPage() {
  const sel =
    'header,nav,main,aside,footer,dialog,[role="dialog"],h1,h2,h3,summary,details,button,a[href],input,select,textarea,[role="radio"],[role="tab"],[role="switch"],[tabindex]';
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const focusable = new Set(
    [...document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')]
      .filter((e) => e.tabIndex >= 0)
      .map((e, i) => [e, i])
      .map(([e, i]) => {
        e.dataset.captureTab = String(i + 1);
        return e;
      }),
  );
  const elements = [...document.querySelectorAll(sel)].map((e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    // Content of a closed <details> (a closed menu) is laid out but not shown; only its summary is.
    const closed = e.parentElement?.closest('details:not([open])');
    const hiddenByDetails = closed && !(e.tagName === 'SUMMARY' && e.parentElement === closed);
    const shown =
      r.width > 0 &&
      r.height > 0 &&
      cs.visibility !== 'hidden' &&
      cs.display !== 'none' &&
      !hiddenByDetails;
    return {
      tag: e.tagName.toLowerCase(),
      role: e.getAttribute('role') || '',
      name: (
        e.getAttribute('aria-label') ||
        [...(e.labels || [])].map((l) => l.textContent).join(' ') ||
        e.textContent ||
        ''
      )
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 60),
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      visible: shown,
      inViewport: shown && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw,
      position: cs.position,
      tabOrder: focusable.has(e) ? Number(e.dataset.captureTab) : null,
    };
  });
  // A long page (the Catalog is 15,000 to 27,000 px tall) would give a JSON of hundreds of KB. Keep the elements in the
  // first two screens and record the totals, so the page size and element count stay known.
  const scrollHeight = document.documentElement.scrollHeight;
  const longPage = scrollHeight > vh * 3;
  const kept = longPage ? elements.filter((e) => e.y < vh * 2) : elements;
  return {
    viewport: { w: vw, h: vh },
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight,
    horizontalScroll: document.documentElement.scrollWidth > vw + 1,
    totalElements: elements.length,
    truncatedBelowY: longPage ? vh * 2 : null,
    elements: kept,
  };
}
