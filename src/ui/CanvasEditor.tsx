import {
  useSyncExternalStore,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useCanvasEditor } from '../store/useCanvasEditor';
import { useMediaQuery } from '../store/useMediaQuery';
import { createListeners } from '../store/deviceValue';
import { t } from '@furniture-builder/i18n';
import { Icon } from './icons';
import { upOneLevel } from './upLevel';

/**
 * The canvas editor on phones (ADR-283, ADR-295): a selection ladder over the drawing, a fixed edit bar at the thumb
 * and a card that shows the whole editor of the selection in one scrolling panel, with a fixed jump index in its head.
 * The editor itself is mounted unchanged.
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

/**
 * The titled blocks of the editor in `ref`, kept up to date. The whole editor shows (ADR-295: no per-block filtering);
 * marks an older version left are cleared.
 */
export function useLens(ref: RefObject<HTMLElement | null>, on: boolean): string[] {
  const [keys, setKeys] = useState<string[]>([]);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    clearLens(root);
    if (!on) return;
    const run = () => {
      const next = lensKeys(root);
      setKeys((k) => (k.join('\u0000') === next.join('\u0000') ? k : next));
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
  }, [ref, on]);
  return on ? keys : [];
}

/** Scrolls the panel `body` so the block titled `key` starts at its top; the overview is the top (ADR-295). */
export function scrollToBlock(body: HTMLElement, key: string): boolean {
  if (key === OVERVIEW) {
    body.scrollTop = 0;
    return true;
  }
  const el = Array.from(body.querySelectorAll('[data-lens-key]')).find(
    (b) => b.getAttribute('data-lens-key') === key,
  );
  if (!el) return false;
  body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top;
  return true;
}

/** Where a section of the jump index lives when the selection does not have it (ADR-295). */
type JumpWhere = 'always' | 'space' | 'settings' | 'project' | 'structure';

/**
 * The jump index (ADR-295): every section title in one fixed order that never depends on the selection or on use.
 * Titles are the blocks' own (`data-lens-key`), so a present block is found by its title.
 */
export function jumpSections(): { key: string; title: string; where: JumpWhere }[] {
  const list: [string, JumpWhere][] = [
    [OVERVIEW, 'always'],
    [t('Structure'), 'structure'],
    [t('Divide this space'), 'space'],
    [t('Division'), 'space'],
    [t('Contents'), 'space'],
    [t('Doors and handles'), 'space'],
    [t('Layouts'), 'space'],
    [t('Staggered rows'), 'space'],
    [t('Bays and shelves'), 'settings'],
    [t('Construction'), 'settings'],
    [t('Legs, rails and stretchers'), 'settings'],
    [t('Drawers and runners'), 'settings'],
    [t('Boards, sheets and saw cut'), 'settings'],
    [t('Checks'), 'settings'],
    [t('Position'), 'project'],
    [t('Project settings'), 'project'],
    [t('Variables'), 'settings'],
    [t('Fasteners'), 'settings'],
    [t('Results'), 'always'],
  ];
  return list.map(([key, where]) => ({
    key,
    title: key === OVERVIEW ? t('Overview') : key,
    where,
  }));
}

/** Why a section of the jump index is not in the panel now: one short line (ADR-295). */
function jumpReason(where: JumpWhere, inProject: boolean): string {
  if (where === 'settings') return t('in Settings');
  if (where === 'project' || (where === 'structure' && inProject))
    return inProject ? t('select a piece in the project') : t('only in a project');
  return t('select a space');
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

/**
 * The edit bar at the bottom of the drawing (ADR-295): Find, Edit (opens the panel, names the selection), the Checks
 * chip and the project's Add actions, always in this order. It never scrolls.
 */
export function EditBar({
  selection,
  open,
  onEdit,
  onFind,
  children,
}: {
  selection: string;
  open: boolean;
  onEdit: () => void;
  onFind: () => void;
  /** The Checks chip and the project's actions, after Edit. */
  children?: ReactNode;
}) {
  return (
    <div className="edit-bar" role="toolbar" aria-label={t('Editor bar')}>
      <button
        type="button"
        className="btn icon chip"
        aria-label={t('Find an action')}
        onClick={onFind}
      >
        <Icon name="search" />
      </button>
      <button
        type="button"
        className="btn chip edit-open"
        aria-expanded={open}
        title={selection}
        onClick={onEdit}
      >
        <Icon name={open ? 'chevron-down' : 'chevron-up'} className="sm" />
        <strong>{t('Edit')}</strong> <span className="edit-sel">{selection}</span>
      </button>
      {children}
    </div>
  );
}

/** The card's head: taller / shorter, the jump index and close (ADR-295). */
export function LensHead({
  keys,
  inProject,
  tall,
  onJump,
  onTall,
  onClose,
}: {
  /** The titled blocks the panel has now. */
  keys: string[];
  inProject: boolean;
  tall: boolean;
  onJump: (k: string) => void;
  onTall: (tall: boolean) => void;
  onClose: () => void;
}) {
  const jumpId = useId();
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
      <label className="sr-only" htmlFor={jumpId}>
        {t('Jump to section')}
      </label>
      {/* A shortcut only (ADR-295): every block is also reached by scrolling. The list never changes order. */}
      <select
        id={jumpId}
        className="jump-index"
        value="__"
        onChange={(e) => {
          const k = e.target.value;
          if (k !== '__') onJump(k === '__overview' ? OVERVIEW : k);
        }}
      >
        <option value="__" disabled hidden>
          {t('Jump to section')}
        </option>
        {jumpSections().map(({ key, title, where }) => {
          const here = where === 'always' || keys.includes(key);
          return (
            <option key={key || '__overview'} value={key || '__overview'} disabled={!here}>
              {here
                ? title
                : t('{title} — {reason}', { title, reason: jumpReason(where, inProject) })}
            </option>
          );
        })}
      </select>
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
interface LensRequest {
  /** The block's title (`data-lens-key`), or OVERVIEW. */
  tab: string;
  /** Finds the control to focus inside the card's editor, once it shows. */
  focus?: (body: HTMLElement) => HTMLElement | null;
  /** Lowers a full card to half, so the change shows on the drawing (Android report 2026-11-22). */
  showDrawing?: boolean;
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

/** Whether an output lens (ADR-288) shows over the drawing: the drawing labels the parts while Parts is open. */
let outLensOn = false;
const outLens = createListeners();
export function setOutLens(on: boolean) {
  if (on === outLensOn) return;
  outLensOn = on;
  outLens.notify();
}
export function useOutLens(): boolean {
  return useSyncExternalStore(outLens.subscribe, () => outLensOn);
}
