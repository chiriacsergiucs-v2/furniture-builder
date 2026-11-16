// The text-contrast measure the capture scripts share (`tools/capture/contrast.mjs`, `tools/capture/flows3.mjs`; G-509):
// every visible text element's colour against the first opaque background above it, with the WCAG 2.2 AA threshold
// (4.5:1, 3:1 for large text). It runs inside the page (`page.evaluate(measure)`), so it uses nothing from this file.

/** Runs in the page: contrast of every visible text element. */
export function measure() {
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const backdrop = (el) => {
    let layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') return { unread: true };
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a === 1) break;
      }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const l of layers.reverse()) base = over(l, base);
    return base;
  };
  const results = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || seen.has(el) || !n.textContent.trim()) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none')
      continue;
    if (
      el.closest('details:not([open]) > :not(summary)') ||
      el.closest('[disabled],[aria-disabled="true"]')
    )
      continue;
    if (el.closest('script,style,svg') || Number(cs.opacity) === 0) continue;
    const fg = parse(cs.color);
    const bg = backdrop(el);
    if (!fg || bg.unread) {
      results.push({ text: n.textContent.trim().slice(0, 40), unread: true });
      continue;
    }
    const f = over(fg, bg);
    const L1 = lum(f),
      L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    results.push({
      text: n.textContent.trim().slice(0, 40),
      ratio: Math.round(ratio * 100) / 100,
      need: large ? 3 : 4.5,
      px,
    });
  }
  return results;
}
