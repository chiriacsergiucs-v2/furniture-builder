// @vitest-environment jsdom
// ADR-206 in jsdom: the client sheet's content in each print language (ro, ru, en), board pictures on door and drawer
// fronts in the front view, and the Front view drawing SVG that embeds the used pictures as JPEG data URLs (falling
// back to plain colour when a picture is missing or cannot be drawn). No request leaves the test.
import 'fake-indexeddb/auto';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildModel } from '../src/core/build';
import { cutlist, hardwareSummary } from '../src/core/cutlist';
import { shoppingList } from '../src/core/shopping';
import { templates, upgradeDesign } from '../src/core/design';
import { setPrintLang, type PrintLang } from '../src/core/i18n/print';
import { makeItem, newProject } from '../src/core/project';
import { withHardwareProduct } from '../src/core/sellers/choices';
import { bytesToBase64 } from '../src/core/surface';
import type { Design } from '../src/core/types';
import type { StoredImage } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';
import { Elevation } from '../src/ui/Elevation';
import { PrintClient } from '../src/ui/PrintClient';
import { downloadFrontSvg } from '../src/ui/shell/files';
import { useUi } from '../src/store/uiStore';

/**
 * The pictures on this device. Kept in a map here: fake-indexeddb clones `bytes` into another realm's ArrayBuffer
 * under jsdom, which `loadImage`'s readability check rightly refuses, so the store is replaced for these tests.
 */
const pictures = new Map<string, StoredImage>();
vi.mock('../src/persist/db', async (orig) => ({
  ...(await orig<typeof import('../src/persist/db')>()),
  loadImage: (id: string) => Promise.resolve(pictures.get(id)),
}));
const saveImage = (img: StoredImage) => {
  pictures.set(img.id, img);
  return Promise.resolve();
};

const tpl = (id: string) => upgradeDesign(templates.find((t) => t.id === id)!.create());
/** The runner line of a chest linked to a Regency product, so the estimate has a seller price. */
const RUNNER = {
  seller: 'regency',
  id: '8146',
  name: 'Glisiera BLUM cu rola extragere partiala 230M2500, alba',
  per: 1,
};
const linkedChest = (): Design => {
  const d = tpl('chest');
  const model = buildModel(d);
  const runner = shoppingList({
    rows: cutlist(model, d.materials),
    materials: d.materials,
    hardware: hardwareSummary(model),
    sheets: null,
  }).find((l) => l.hardwareKind === 'drawer-runner-pair')!;
  return { ...withHardwareProduct(d, runner.productKey!, RUNNER), name: 'Comoda Ana' };
};

beforeEach(() => {
  // No Web Worker in jsdom: the sheet layout runs on the main thread (useNesting's fallback).
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
});
afterEach(() => {
  cleanup();
  setPrintLang('ro');
  useUi.getState().setPrinting(false);
  vi.unstubAllGlobals();
});

const TEXT: Record<
  PrintLang,
  { title: string; size: string; price: string; unpriced: string; sellers: string }
> = {
  ro: {
    title: 'Fișă pentru client',
    size: 'Dimensiuni L × Î × A, mm',
    price: 'Preț estimat',
    unpriced: 'linii fără preț',
    sellers: 'Prețuri de vânzător: Regency Company, 2026-10-29',
  },
  ru: {
    title: 'Лист для клиента',
    size: 'Размеры Ш × В × Г, мм',
    price: 'Ориентировочная цена',
    unpriced: 'строк без цены',
    sellers: 'Цены продавца: Regency Company, 2026-10-29',
  },
  en: {
    title: 'Client sheet',
    size: 'Size W × H × D, mm',
    price: 'Estimated price',
    unpriced: 'lines without a price',
    sellers: 'Seller prices: Regency Company, 2026-10-29',
  },
};
const LOCALE: Record<PrintLang, string> = { ro: 'ro-RO', ru: 'ru-RU', en: 'en-GB' };

describe.each(['ro', 'ru', 'en'] as const)('client sheet in %s (ADR-206, G-020)', (lang) => {
  it('name and date, one picture, the piece W × H × D, the estimate, unpriced lines counted, seller and date', async () => {
    setPrintLang(lang);
    const d = linkedChest();
    useDesign.getState().load(d);
    useUi.getState().printWith('client', { client: 'data:image/png;base64,AAAA' });
    const { container } = render(<PrintClient />);
    const root = container.querySelector('.print-root')!;
    const L = TEXT[lang];
    expect(root.querySelector('h1')?.textContent).toBe('Comoda Ana');
    expect(root.querySelector('.pr-head p')?.textContent).toBe(
      `${L.title} · ${new Date().toLocaleDateString(LOCALE[lang])}`,
    );
    // One picture: the one chosen when the sheet was asked for.
    const imgs = root.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(root.querySelector('.pr-elev')).toBeNull();
    // The piece list: name, W × H × D from the model, quantity.
    const b = buildModel(d).bounds;
    expect(root.textContent).toContain(L.size);
    const cells = [...root.querySelectorAll('tbody tr td')].map((td) => td.textContent);
    expect(cells).toEqual(['Comoda Ana', `${b.w} × ${b.h} × ${b.d}`, '1']);
    // The estimate: the runner from the seller; every line without a price is counted, never hidden.
    await waitFor(() => expect(root.textContent).toContain(L.sellers), { timeout: 15000 });
    const total = root.querySelector('.pr-client-total h2')!.textContent!;
    expect(total).toMatch(new RegExp(`^${L.price}: [\\d.]+,\\d\\d `));
    expect(total).not.toMatch(/: 0,00 /);
    const missing = [...root.querySelectorAll('.pr-client-total p')]
      .map((p) => p.textContent!)
      .find((x) => x.includes(L.unpriced));
    expect(missing).toMatch(new RegExp(`^[1-9]\\d* ${L.unpriced}$`));
  });
});

describe('client sheet picture and project pieces (ADR-206)', () => {
  it('without a render or a 3D still the sheet prints the front view', () => {
    useDesign.getState().load(tpl('chest'));
    useUi.getState().printWith('client', { client: null });
    const { container } = render(<PrintClient />);
    expect(container.querySelectorAll('.print-root img')).toHaveLength(0);
    expect(container.querySelector('.print-root .pr-elev svg')).not.toBeNull();
  });
  it('a project lists each piece with its size and quantity under the project name', () => {
    let p = newProject('Bucătărie Ion');
    const a = { ...tpl('base-door'), name: 'Corp chiuvetă' };
    const b = { ...tpl('chest'), name: 'Comodă' };
    p = { ...p, items: [makeItem(p, a)] };
    p = { ...p, items: [...p.items, { ...makeItem(p, b), quantity: 2 }] };
    useDesign.getState().openProject(p);
    useUi.getState().printWith('client', { client: null });
    const { container } = render(<PrintClient />);
    expect(container.querySelector('.print-root h1')?.textContent).toBe('Bucătărie Ion');
    const rows = [...container.querySelectorAll('.print-root tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent),
    );
    const ba = buildModel(a).bounds,
      bb = buildModel(b).bounds;
    expect(rows).toEqual([
      ['Corp chiuvetă', `${ba.w} × ${ba.h} × ${ba.d}`, '1'],
      ['Comodă', `${bb.w} × ${bb.h} × ${bb.d}`, '2'],
    ]);
    useDesign.getState().closeProject();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Board pictures on fronts and in the SVG download (G-001)
// ---------------------------------------------------------------------------------------------------------------

/** A tiny real JPEG (1×1), so the bytes in the SVG are the stored ones. */
const JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  ),
  (c) => c.charCodeAt(0),
);
const picturedDesign = (imageId: string): Design => {
  const d = tpl('base-door');
  return {
    ...d,
    name: 'Corp',
    materials: d.materials.map((m) => ({
      ...m,
      color: '#c8a27a',
      image: { id: imageId, name: 'oak.jpg', tileLength: 1000, tileWidth: 500 },
    })),
  };
};

/** The front view the way the app nests it (`.view.front .elevation svg`), with its pictures loaded. */
async function frontView(d: Design) {
  useDesign.getState().load(d);
  useDesign.getState().setShowFronts(true);
  const r = render(
    <div className="view front">
      <Elevation />
    </div>,
  );
  await waitFor(() => expect(r.container.querySelector('pattern')).not.toBeNull());
  return r;
}

/**
 * The saved file as a document. Parsed leniently: jsdom's XMLSerializer writes the root's `xmlns` twice (a browser
 * writes it once; the browser script `tools/prints-exports/find-it.mjs` checks the real file).
 */
const parseSvg = (text: string) => new DOMParser().parseFromString(text, 'text/html');

/** The text of the SVG file `downloadFrontSvg` saves. */
async function savedSvg(d: Design): Promise<{ ok: boolean; text: string }> {
  let blob: Blob | null = null;
  URL.createObjectURL = vi.fn((b: Blob) => {
    blob = b;
    return 'blob:svg';
  }) as never;
  HTMLAnchorElement.prototype.click = () => {};
  let ok = false;
  await act(async () => {
    ok = await downloadFrontSvg(d);
  });
  return { ok, text: blob ? await (blob as Blob).text() : '' };
}

describe('board pictures on fronts and in the Front view drawing (ADR-206, G-001)', () => {
  beforeEach(async () => {
    pictures.clear();
    let n = 0;
    URL.createObjectURL = vi.fn(() => `blob:pic-${n++}`) as never;
    URL.revokeObjectURL = vi.fn();
  });

  it('door fronts fill with their board picture pattern and keep the plain colour for the file', async () => {
    await saveImage({
      id: 'img-oak',
      name: 'oak.jpg',
      type: 'image/jpeg',
      width: 1,
      height: 1,
      bytes: JPEG.buffer.slice(0),
      createdAt: '2026-11-06T00:00:00Z',
    });
    const { container } = await frontView(picturedDesign('img-oak'));
    const fronts = [...container.querySelectorAll<SVGPolygonElement>('polygon.el-front')];
    expect(fronts.length).toBeGreaterThan(0);
    for (const f of fronts) {
      expect(f.getAttribute('style') ?? '').toMatch(/fill: url\("?#[^)]+-pic-/);
      expect(f.getAttribute('data-plain')).toBe('#c8a27a');
    }
    const ids = new Set([...container.querySelectorAll('pattern')].map((p) => p.id));
    for (const f of fronts) {
      const id = /url\("?#([^")]+)/.exec(f.getAttribute('style')!)![1];
      expect(ids.has(id)).toBe(true);
    }
  });

  it('downloadFrontSvg is async and embeds each used picture as a JPEG data URL from the stored image', async () => {
    await saveImage({
      id: 'img-oak',
      name: 'oak.jpg',
      type: 'image/jpeg',
      width: 1,
      height: 1,
      bytes: JPEG.buffer.slice(0),
      createdAt: '2026-11-06T00:00:00Z',
    });
    const d = picturedDesign('img-oak');
    await frontView(d);
    const result = downloadFrontSvg(d);
    expect(result).toBeInstanceOf(Promise);
    await act(async () => {
      await result;
    });
    const { ok, text } = await savedSvg(d);
    expect(ok).toBe(true);
    const svg = parseSvg(text);
    const images = [...svg.querySelectorAll('pattern image')];
    expect(images.length).toBeGreaterThan(0);
    const href = `data:image/jpeg;base64,${bytesToBase64(JPEG.buffer.slice(0))}`;
    for (const img of images) expect(img.getAttribute('href')).toBe(href);
    // No device-only blob URL and no helper attribute travel in the file; unused patterns are dropped.
    expect(text).not.toContain('blob:');
    expect(text).not.toContain('data-plain');
    expect(text).not.toContain('data-image');
    const used = new Set(
      [...svg.querySelectorAll('[style*="url("]')].map(
        (n) => /url\(["']?#([^"')]+)/.exec(n.getAttribute('style')!)![1],
      ),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const p of svg.querySelectorAll('pattern')) expect(used.has(p.id)).toBe(true);
    const fronts = [...svg.querySelectorAll('polygon.el-front')];
    expect(fronts.every((f) => /url\(/.test(f.getAttribute('style') ?? ''))).toBe(true);
  });

  it('a picture missing from the device, or one that cannot be drawn, falls back to the plain colour', async () => {
    // Shown in the app (loaded once), then gone from the device before the download.
    await saveImage({
      id: 'img-oak',
      name: 'oak.jpg',
      type: 'image/jpeg',
      width: 1,
      height: 1,
      bytes: JPEG.buffer.slice(0),
      createdAt: '2026-11-06T00:00:00Z',
    });
    const d = picturedDesign('img-oak');
    await frontView(d);
    pictures.clear();
    let { ok, text } = await savedSvg(d);
    expect(ok).toBe(true);
    let svg = parseSvg(text);
    expect(svg.querySelectorAll('pattern')).toHaveLength(0);
    expect(text).not.toContain('url(#');
    const filled = [...svg.querySelectorAll('polygon')].filter((p) =>
      /fill:/.test(p.getAttribute('style') ?? ''),
    );
    expect(filled.length).toBeGreaterThan(0);
    for (const p of filled)
      expect(p.getAttribute('style')).toMatch(/fill: (#c8a27a|rgb\(200, 162, 122\))/);
    cleanup();

    // A PNG this browser cannot draw (no createImageBitmap in jsdom): plain colour too, no throw.
    await saveImage({
      id: 'img-png',
      name: 'oak.png',
      type: 'image/png',
      width: 1,
      height: 1,
      bytes: new Uint8Array([137, 80, 78, 71]).buffer,
      createdAt: '2026-11-06T00:00:00Z',
    });
    const d2 = picturedDesign('img-png');
    await frontView(d2);
    ({ ok, text } = await savedSvg(d2));
    expect(ok).toBe(true);
    svg = parseSvg(text);
    expect(svg.querySelectorAll('pattern')).toHaveLength(0);
    expect(text).not.toContain('blob:');
  });

  it('without a front view on screen there is nothing to save', async () => {
    const { ok } = await savedSvg(tpl('chest'));
    expect(ok).toBe(false);
  });
});
