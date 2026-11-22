import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { bumpLensUse, orderByUse, useCanvasEditor, useLensUse } from '../store/useCanvasEditor';
import { useMediaQuery } from '../store/useMediaQuery';
import { t } from '@furniture-builder/i18n';
import { Icon } from './icons';
import { upOneLevel } from './upLevel';

/**
 * The canvas editor on phones (ADR-283): a selection ladder over the drawing, a chip rail at the thumb and a lens card
 * that shows one titled block of the existing editor at a time. The editor itself is mounted unchanged; this file only
 * chooses which of its blocks shows.
 */

/** The tab that shows everything outside the titled blocks: the title, path, pins, buttons and notes. */
export const OVERVIEW = '';

/** Titled blocks (`data-lens-key`, set by Section and Group) at the top level of `root`, in page order. */
export function lensKeys(root: Element | null): string[] {
  if (!root) return [];
  const keys: string[] = [];
  root.querySelectorAll('[data-lens-key]').forEach((el) => {
    const k = el.getAttribute('data-lens-key');
    if (!k) return;
    if (
      el.parentElement?.closest('[data-lens-key]') &&
      root.contains(el.parentElement.closest('[data-lens-key]'))
    )
      return;
    if (!keys.includes(k)) keys.push(k);
  });
  return keys;
}

/**
 * Marks with `data-lens-off` every element of `root` that is not part of the active block, so one block shows at a
 * time; on the overview tab every titled block is off and the rest shows. Kept up to date while the editor re-renders.
 */
export function applyLens(root: Element, active: string) {
  const blocks = Array.from(root.querySelectorAll('[data-lens-key]')).filter(
    (el) =>
      !el.parentElement?.closest('[data-lens-key]') ||
      !root.contains(el.parentElement.closest('[data-lens-key]')),
  );
  const target =
    active === OVERVIEW
      ? null
      : (blocks.find((b) => b.getAttribute('data-lens-key') === active) ?? null);
  const visit = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const isBlock = blocks.includes(child);
      let off: boolean;
      if (target) off = !(child === target || child.contains(target));
      else off = isBlock;
      if (off) {
        if (!child.hasAttribute('data-lens-off')) child.setAttribute('data-lens-off', '');
      } else {
        if (child.hasAttribute('data-lens-off')) child.removeAttribute('data-lens-off');
        if (child !== target && !isBlock) visit(child);
      }
    }
  };
  visit(root);
}

/** Clears every mark `applyLens` set, for when the canvas editor is turned off. */
export function clearLens(root: Element) {
  root.querySelectorAll('[data-lens-off]').forEach((el) => el.removeAttribute('data-lens-off'));
}

/** The titled blocks of the editor in `ref`, and the active one applied to it, kept up to date. */
export function useLens(ref: RefObject<HTMLElement | null>, on: boolean, active: string): string[] {
  const [keys, setKeys] = useState<string[]>([]);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!on) {
      clearLens(root);
      return;
    }
    const run = () => {
      const next = lensKeys(root);
      setKeys((k) => (k.join('\u0000') === next.join('\u0000') ? k : next));
      applyLens(root, next.includes(active) ? active : OVERVIEW);
    };
    run();
    if (typeof MutationObserver === 'undefined') return;
    let busy = false;
    const mo = new MutationObserver(() => {
      if (busy) return;
      busy = true;
      queueMicrotask(() => {
        run();
        busy = false;
      });
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [ref, on, active]);
  return on ? keys : [];
}

/** One level of the selection ladder and how to go back up to it. */
export interface Crumb {
  label: string;
  go: () => void;
}

/** `Project › Piece › Space`: where the selection is, each step a button that goes up to it, and ↑ one level. */
export function LadderPill({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div className="ladder">
      <button
        type="button"
        className="btn icon ladder-up"
        aria-label={t('Up one level')}
        disabled={crumbs.length < 2}
        onClick={upOneLevel}
      >
        <Icon name="chevron-up" />
      </button>
      <nav className="ladder-crumbs" aria-label={t('Selection path')}>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={i} className="ladder-step">
              {i > 0 && <span aria-hidden="true">›</span>}
              <button
                type="button"
                className={`ladder-crumb${last ? ' cur' : ''}`}
                aria-current={last ? 'location' : undefined}
                title={c.label}
                onClick={last ? undefined : c.go}
              >
                {c.label}
              </button>
            </span>
          );
        })}
      </nav>
    </div>
  );
}

const label = (k: string) => (k === OVERVIEW ? t('Overview') : k);

/** The chip rail at the bottom of the drawing: the selection's blocks, most used on this device first. */
export function ChipRail({
  keys,
  onPick,
  onFind,
  children,
}: {
  keys: string[];
  onPick: (k: string) => void;
  onFind: () => void;
  children?: ReactNode;
}) {
  const used = useLensUse();
  const ordered = [OVERVIEW, ...orderByUse(keys, used)];
  return (
    <div className="chip-rail" role="toolbar" aria-label={t('Editor actions')}>
      {/* Find (ADR-283): a later slice searches every action; until then it opens the card on its tab list. */}
      <button
        type="button"
        className="btn icon chip"
        aria-label={t('Find an action')}
        onClick={onFind}
      >
        <Icon name="search" />
      </button>
      {children}
      {ordered.map((k) => (
        <button
          key={k || 'overview'}
          type="button"
          className="btn chip"
          onClick={() => {
            bumpLensUse(k || 'overview');
            onPick(k);
          }}
        >
          {label(k)}
        </button>
      ))}
    </div>
  );
}

/** The lens card's head: one tab per block, compact / tall, close. */
export function LensHead({
  keys,
  active,
  tall,
  onPick,
  onTall,
  onClose,
}: {
  keys: string[];
  active: string;
  tall: boolean;
  onPick: (k: string) => void;
  onTall: (tall: boolean) => void;
  onClose: () => void;
}) {
  const shown = keys.includes(active) ? active : OVERVIEW;
  const tabs = [OVERVIEW, ...keys];
  const tabsRef = useRef<HTMLDivElement>(null);
  // The chosen tab scrolls into sight in the tab row, so the card always says which block it shows.
  useEffect(() => {
    tabsRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [shown, keys]);
  return (
    <div className="lens-head">
      <button
        type="button"
        className="btn icon ghost"
        aria-label={tall ? t('Shorter card') : t('Taller card')}
        aria-expanded={tall}
        onClick={() => onTall(!tall)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onTall(true);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onTall(false);
          }
        }}
      >
        <Icon name={tall ? 'chevron-down' : 'chevron-up'} />
      </button>
      <div className="lens-tabs" role="tablist" aria-label={t('Editor card')} ref={tabsRef}>
        {tabs.map((k) => (
          <button
            key={k || 'overview'}
            type="button"
            role="tab"
            aria-selected={k === shown}
            className={k === shown ? 'on' : ''}
            onClick={() => onPick(k)}
          >
            {label(k)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn icon ghost"
        aria-label={t('Close the card')}
        onClick={onClose}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}

/** The card's height in px while open, written to `--lens-h` on `target` so the drawing re-frames above it. */
export function useLensHeight(
  card: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>,
  on: boolean,
) {
  useEffect(() => {
    const el = card.current,
      tg = target.current;
    if (!el || !tg) return;
    if (!on || typeof ResizeObserver === 'undefined') {
      tg.style.removeProperty('--lens-h');
      return;
    }
    const ro = new ResizeObserver(() =>
      tg.style.setProperty('--lens-h', `${Math.round(el.offsetHeight)}px`),
    );
    ro.observe(el);
    return () => {
      ro.disconnect();
      tg.style.removeProperty('--lens-h');
    };
  }, [card, target, on]);
}

/**
 * Points the card at the selection (ADR-283): `--lens-anchor` on the card is the selected part's centre, measured
 * from the card's left edge; with nothing selected on the drawing the card has no pointer.
 */
export function useLensAnchor(
  card: RefObject<HTMLElement | null>,
  stage: RefObject<HTMLElement | null>,
  on: boolean,
) {
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const sel = on ? stage.current?.querySelector('.selected') : null;
    if (!sel) {
      el.removeAttribute('data-anchored');
      return;
    }
    const a = sel.getBoundingClientRect(),
      c = el.getBoundingClientRect();
    const x = Math.min(Math.max(a.left + a.width / 2 - c.left, 16), Math.max(16, c.width - 16));
    el.style.setProperty('--lens-anchor', `${Math.round(x)}px`);
    el.setAttribute('data-anchored', '');
  });
}

/** True while the canvas editor runs: the device flag is on and the screen is a phone (ADR-283). */
export function useCanvas(): boolean {
  const [on] = useCanvasEditor();
  return useMediaQuery('(max-width: 760px)') && on;
}

/** A request to open the lens card on a block and focus one control in it (ADR-284). */
export interface LensRequest {
  /** The block's title (`data-lens-key`), or OVERVIEW. */
  tab: string;
  /** Finds the control to focus inside the card's editor, once it shows. */
  focus?: (body: HTMLElement) => HTMLElement | null;
}
const LENS_EVENT = 'fb:lens';

/** Asks the canvas editor to open its card on `tab` and focus a control (ADR-284). */
export function openLens(req: LensRequest) {
  window.dispatchEvent(new CustomEvent<LensRequest>(LENS_EVENT, { detail: req }));
}

/** Calls `fn` for each lens request while mounted. */
export function useLensRequests(fn: (req: LensRequest) => void) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const on = (e: Event) => ref.current((e as CustomEvent<LensRequest>).detail);
    window.addEventListener(LENS_EVENT, on);
    return () => window.removeEventListener(LENS_EVENT, on);
  }, []);
}

/** The control a visible `<label>` with this exact text names, inside `body` (MmField and its kin, ADR-284). */
export function controlByLabel(body: HTMLElement, text: string): HTMLElement | null {
  for (const l of Array.from(body.querySelectorAll('label'))) {
    if (l.textContent?.trim() !== text) continue;
    const id = l.getAttribute('for');
    const el = id ? document.getElementById(id) : l.querySelector('input, select, textarea');
    if (el) return el as HTMLElement;
  }
  return null;
}

/**
 * How far the on-screen keyboard reaches up from the bottom of the window, in px (ADR-284): the part of the window the
 * visual viewport no longer covers. 0 without a keyboard or a visual viewport.
 */
export function keyboardInset(innerHeight: number, vvHeight?: number, vvOffsetTop = 0): number {
  if (vvHeight === undefined) return 0;
  return Math.max(0, Math.round(innerHeight - vvHeight - vvOffsetTop));
}

/** Writes `--kb` (the keyboard's height) on `target` while on, so the card sits on the keyboard (ADR-284). */
export function useKeyboardInset(target: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const vv = window.visualViewport;
    const tg = target.current;
    if (!on || !vv || !tg) return;
    const set = () =>
      tg.style.setProperty(
        '--kb',
        `${keyboardInset(window.innerHeight, vv.height, vv.offsetTop)}px`,
      );
    set();
    vv.addEventListener('resize', set);
    vv.addEventListener('scroll', set);
    return () => {
      vv.removeEventListener('resize', set);
      vv.removeEventListener('scroll', set);
      tg.style.removeProperty('--kb');
    };
  }, [target, on]);
}
