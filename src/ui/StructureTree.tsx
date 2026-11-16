import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../core/i18n';
import { ancestorIds, structureRows } from '../core/spaceTree';
import { useDesign } from '../store/designStore';
import { useUi } from '../store/uiStore';
import { PHONE, useMediaQuery } from '../store/useMediaQuery';
import { Group } from './controls';
import { Icon } from './icons';

const WHOLE_KEY = '#whole';
const keyOf = (id: string | null) => id ?? WHOLE_KEY;

/**
 * The structure group of the compose drawer (ADR-268): the piece as a tree of its spaces, following the selection.
 * Open on desktop, closed in the phone sheet. Keyboard model of the W3C tree pattern: arrows move focus, and focus
 * never selects; Enter or Space (or a click) does.
 */
export function StructureTree() {
  const phone = useMediaQuery(PHONE);
  return (
    <Group title={t('Structure')} id="g-structure" defaultOpen={!phone}>
      <Tree />
    </Group>
  );
}

function Tree() {
  const prod = useDesign((s) => s.design.product);
  const selectedId = useDesign((s) => s.selectedId);
  const select = useDesign((s) => s.select);
  const model = useDesign((s) => s.model);
  const open = useUi((s) => s.treeOpen);
  const setTreeOpen = useUi((s) => s.setTreeOpen);
  const openTree = useUi((s) => s.openTree);
  const setHover = useUi((s) => s.setHover);
  // A row previews its space on the drawing like a hover there (ADR-269); touch has no hover.
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const rows = useMemo(() => structureRows(prod, new Set(open)), [prod, open]);
  const sizes = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of model.spaces) m.set(o.nodeId, `${o.box.w} × ${o.box.h}`);
    return m;
  }, [model]);
  const selKey = typeof selectedId === 'string' || selectedId === null ? keyOf(selectedId) : null;
  // The roving tab stop: the focused row, else the selected one, else the first.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const box = useRef<HTMLDivElement>(null);

  // Follow the selection: open its ancestors, then bring its row into view inside the tree only.
  useEffect(() => {
    if (typeof selectedId === 'string') openTree(ancestorIds(prod, selectedId));
  }, [selectedId, prod, openTree]);
  useEffect(() => {
    const el = selKey ? refs.current.get(selKey) : undefined;
    const c = box.current;
    if (!el || !c) return;
    const top = el.offsetTop - c.offsetTop;
    if (top < c.scrollTop) c.scrollTop = top;
    else if (top + el.offsetHeight > c.scrollTop + c.clientHeight)
      c.scrollTop = top + el.offsetHeight - c.clientHeight;
  }, [selKey, rows]);

  const tabKey =
    focusKey && rows.some((r) => keyOf(r.id) === focusKey)
      ? focusKey
      : selKey && rows.some((r) => keyOf(r.id) === selKey)
        ? selKey
        : keyOf(rows[0].id);
  const focusRow = (i: number) => {
    const r = rows[Math.max(0, Math.min(rows.length - 1, i))];
    setFocusKey(keyOf(r.id));
    refs.current.get(keyOf(r.id))?.focus();
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const r = rows[i];
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const stop = () => e.preventDefault();
    switch (e.key) {
      case 'ArrowDown':
        stop();
        focusRow(i + 1);
        break;
      case 'ArrowUp':
        stop();
        focusRow(i - 1);
        break;
      case 'Home':
        stop();
        focusRow(0);
        break;
      case 'End':
        stop();
        focusRow(rows.length - 1);
        break;
      case 'ArrowRight':
        stop();
        if (r.id !== null && r.hasChildren) {
          if (!r.open) setTreeOpen(r.id, true);
          else focusRow(i + 1);
        }
        break;
      case 'ArrowLeft':
        stop();
        if (r.id !== null && r.open) setTreeOpen(r.id, false);
        else {
          // To the parent: the nearest row above with a lower depth.
          for (let j = i - 1; j >= 0; j--)
            if (rows[j].depth < r.depth) {
              focusRow(j);
              break;
            }
        }
        break;
      case 'Enter':
      case ' ':
        stop();
        select(r.id);
        break;
    }
  };

  return (
    <div className="structure-tree" ref={box}>
      <div role="tree" aria-label={t('Whole piece tree')}>
        {rows.map((r, i) => {
          const k = keyOf(r.id);
          const size = r.id ? sizes.get(r.id) : undefined;
          return (
            <div
              key={k}
              ref={(el) => {
                if (el) refs.current.set(k, el);
                else refs.current.delete(k);
              }}
              role="treeitem"
              aria-level={r.depth}
              aria-selected={k === selKey}
              aria-expanded={r.id !== null && r.hasChildren ? r.open : undefined}
              tabIndex={k === tabKey ? 0 : -1}
              className={`tree-row${k === selKey ? ' selected' : ''}`}
              style={{ paddingInlineStart: `calc(var(--s-2) + ${(r.depth - 1) * 16}px)` }}
              onClick={() => {
                setFocusKey(k);
                select(r.id);
              }}
              onFocus={() => setFocusKey(k)}
              onMouseEnter={canHover ? () => setHover(r.id) : undefined}
              onMouseLeave={canHover ? () => setHover(undefined) : undefined}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget) onKey(e, i);
              }}
            >
              {r.id !== null && r.hasChildren ? (
                <span
                  className="tree-chev"
                  aria-hidden="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTreeOpen(r.id as string, !r.open);
                  }}
                >
                  <Icon name={r.open ? 'chevron-down' : 'chevron-right'} className="sm" />
                </span>
              ) : (
                <span className="tree-chev" aria-hidden="true" />
              )}
              <span className="tree-name">
                {size ? t('{name}, {size} mm', { name: r.label, size }) : r.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
