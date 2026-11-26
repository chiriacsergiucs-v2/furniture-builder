import { svgId } from './svgId';
import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import {
  changeKind,
  findInProduct,
  parentOf as spaceParent,
  productRoots,
  splitSpace,
} from '../core/design';
import { snapIsOn } from '../store/useSnap';
import { boxCentre } from '../core/geometry';
import { DRAWER_BOX_ROLES, FRONT_ROLES } from '../core/panelRoles';
import { pt } from '@furniture-builder/i18n/print';
import { t } from '@furniture-builder/i18n';
import {
  FOCUS_OPACITY,
  deepestAt,
  drill,
  inSelection,
  parentOf as parentSel,
  pathAt,
  selectionBox,
  type Selection,
} from '../core/selectPath';
import { KIND_LABEL, WHOLE_LABEL, nameOfSpace } from '../core/spaceNames';
import { faceMapping } from '../core/surface';
import { imageKey, useImageUrls } from '../store/useImageUrls';
import { useDesign } from '../store/designStore';
import { useUi } from '../store/uiStore';
import { useEntered } from '../store/useEntered';
import { useMediaQuery } from '../store/useMediaQuery';
import type { Diagnostic, FurnitureModel, Material, Panel, SpaceOpening } from '../core/types';
import { frontOutline } from '../core/shape';
import { boxIn, cardCorner, CountStepper } from './CountStepper';
import { WallBehind } from './WallBehind';
import { controlByLabel, openLens, OVERVIEW, useCanvas, useOutLens } from './CanvasEditor';
import { useView } from '../store/useView';

/** SVG points of a panel's front outline (y flipped so the floor is at the bottom). */
export const outlinePoints = (p: Panel) =>
  frontOutline(p)
    .map(([x, y]) => `${x},${-y}`)
    .join(' ');

/** The smallest a drawing label is drawn on screen, in CSS pixels (audit F-26). */
const MIN_LABEL_PX = 8;

function describe(s: SpaceOpening, count?: number, print = false): string {
  // On a printed sheet the labels follow the print language (ADR-157, ADR-265).
  if (print)
    switch (s.kind) {
      case 'empty':
        return pt('Gol');
      case 'shelves':
        return pt('{n|# raft|# rafturi}', { n: count ?? 0 });
      case 'drawers':
        return pt('{n|# sertar|# sertare}', { n: count ?? 0 });
      case 'hanging':
        return pt('Spațiu de agățat');
      case 'split':
        return '';
    }
  switch (s.kind) {
    case 'empty':
      return t('Empty');
    case 'shelves':
      return t('{n|# shelf|# shelves}', { n: count ?? 0 });
    case 'drawers':
      return t('{n|# drawer|# drawers}', { n: count ?? 0 });
    case 'hanging':
      return t('Hanging');
    case 'split':
      return '';
  }
}

/**
 * Front elevation: the editing surface. Structure is drawn solid, fronts as dashed outlines,
 * a tap selects the whole piece, then one level smaller per tap (ADR-083). Y is flipped so the floor is at the bottom.
 */
/** `print`: drawn on a printed sheet, labels in the print language (ADR-265). */
export function Elevation({ print = false }: { print?: boolean } = {}) {
  const model = useDesign((s) => s.model);
  const design = useDesign((s) => s.design);
  const selectedId = useDesign((s) => s.selectedId);
  const tapPiece = useDesign((s) => s.tapPiece);
  const select = useDesign((s) => s.select);
  // Hover (ADR-269): only a pointer that can hover; touch is unchanged. It never changes the selection.
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)') && !print;
  const hoverId = useUi((s) => s.hoverId);
  const setHover = useUi((s) => s.setHover);
  const pinnedId = useUi((s) => s.pinnedId);
  const enteredId = useEntered();
  const enter = useUi((s) => s.enter);
  const focusLook = useUi((s) => s.focusLook);
  const showFronts = useDesign((s) => s.showFronts);
  const mats = useMemo(() => new Map(design.materials.map((m) => [m.id, m])), [design.materials]);
  // Pictures on boards (ADR-048): one pattern per material and direction; plain colour while missing.
  const urls = useImageUrls(imageKey(design.materials));
  const uid = svgId(useId());
  const patId = (materialId: string, turned: boolean) =>
    `${uid}-pic-${svgId(materialId)}-${turned ? 1 : 0}`;
  /** The board's picture pattern, or undefined while it has none on this device. */
  const pictureOf = (p: Panel) => {
    const m = mats.get(p.materialId);
    const url = m?.image ? urls.get(m.image.id) : undefined;
    if (!m?.image || !url || url === 'missing') return undefined;
    return `url(#${patId(m.id, faceMapping(p, m.image, 'x', 'y').u[0] === 0)})`;
  };
  const fillOf = (p: Panel) => pictureOf(p) ?? mats.get(p.materialId)?.color;

  const b = model.bounds;
  const pad = Math.max(b.w, b.h) * 0.09;
  const vb = `${b.x - pad} ${-(b.y + b.h) - pad} ${b.w + 2 * pad} ${b.h + 2 * pad * 1.4}`;
  const Y = (y: number, h: number) => -(y + h);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    const walk = (s: import('../core/types').Space) => {
      if (s.kind === 'shelves' || s.kind === 'drawers') m.set(s.id, s.count);
      if (s.kind === 'split') s.children.forEach(walk);
    };
    productRoots(design.product).forEach((r) => walk(r.root));
    return m;
  }, [design.product]);

  const BEHIND = new Set<Panel['role']>(['back', 'modesty']);
  const structure = model.panels.filter(
    (p) => !FRONT_ROLES.has(p.role) && !DRAWER_BOX_ROLES.has(p.role) && !BEHIND.has(p.role),
  );
  const backs = model.panels.filter((p) => BEHIND.has(p.role));
  const fronts = model.panels.filter((p) => FRONT_ROLES.has(p.role));
  const selectedPanels = new Set(
    model.panels.filter((p) => p.nodeId === selectedId).map((p) => p.id),
  );
  // The whole piece selected (ADR-083) is outlined round its bounds; everything outside the outline is faded (ADR-087).
  const selBox = selectionBox(model, selectedId);
  const selectedSpace = selBox ? { box: selBox } : undefined;
  // What stays solid: the entered space (ADR-270), else the selection; everything outside fades or, under Hide, goes.
  const enteredBox = enteredId ? selectionBox(model, enteredId) : undefined;
  const keepBox = enteredBox ?? selBox;
  const fade = (box: Panel['box']) => (keepBox && !inSelection(keepBox, box) ? ' faded' : '');
  const shown = (box: Panel['box']) => !(focusLook === 'hide' && fade(box));
  // Labels never draw smaller than MIN_LABEL_PX on screen (audit F-26): the viewBox shrinks to the phone's width, so a
  // size set in drawing units alone came out 5 to 6 px tall at 390 px.
  const [pxScale, setPxScale] = useState(0);
  const floorUnits = !print && pxScale > 0 ? MIN_LABEL_PX / pxScale : 0;
  const fontSize = Math.max(Math.max(b.w, b.h) / 26, floorUnits);
  // Size tags (ADR-284): in the canvas editor a size on the drawing is a button that opens its field in the card.
  const canvas = useCanvas() && !print;
  const hit = pxScale > 0 ? 44 / pxScale : fontSize * 3;
  const wholeTag = (field: 'Width' | 'Height' | 'Depth', n: number): DimTag | undefined =>
    canvas
      ? {
          name:
            field === 'Width'
              ? t('Width {n} mm', { n })
              : field === 'Height'
                ? t('Height {n} mm', { n })
                : t('Depth {n} mm', { n }),
          hit,
          onActivate: () => {
            select(null);
            const label =
              field === 'Width' ? t('Width') : field === 'Height' ? t('Height') : t('Depth');
            openLens({ tab: OVERVIEW, focus: (body) => controlByLabel(body, label) });
          },
        }
      : undefined;
  // The split around the selected part, from the design tree (a part's size lives in its parent's Division).
  const partFound =
    canvas && typeof selectedId === 'string'
      ? findInProduct(design.product, selectedId)
      : undefined;
  const partSpace = partFound ? spaceParent(partFound.root, partFound.space.id) : undefined;
  const partParent: Selection = partSpace ? partSpace.id : null;
  const partAxis = partSpace?.kind === 'split' ? partSpace.axis : undefined;
  const partTag = (name: string): DimTag | undefined =>
    canvas && partParent !== null && typeof selectedId === 'string'
      ? {
          name,
          hit,
          onActivate: () => {
            const part = selectedId;
            select(partParent);
            openLens({
              tab: t('Division'),
              focus: (body) => body.querySelector<HTMLElement>(`[data-part-id="${part}"] input`),
            });
          },
        }
      : undefined;
  // Divide handles and dividers on the drawing (ADR-285): the same splits the Divide and Division blocks make.
  const updateSpace = useDesign((st) => st.updateSpace);
  const selFound =
    canvas && typeof selectedId === 'string'
      ? findInProduct(design.product, selectedId)
      : undefined;
  const selNode = selFound?.space;
  // The split whose dividers show: the selected split, else the split around the selected part.
  const barSplit =
    selNode?.kind === 'split' ? selNode : partSpace?.kind === 'split' ? partSpace : undefined;
  const barBoxes =
    barSplit?.kind === 'split'
      ? barSplit.children.map(
          (c) => model.spaces.find((o) => o.nodeId === c.id && o.view !== 'side')?.box,
        )
      : [];
  const [barDrag, setBarDrag] = useState<{ i: number; value: number } | null>(null);
  const commitBar = (i: number, value: number) => {
    if (!barSplit || barSplit.kind !== 'split') return;
    updateSpace(barSplit.id, (sp) =>
      sp.kind === 'split'
        ? { ...sp, sizes: sp.sizes.map((z, j) => (j === i ? { mode: 'mm' as const, value } : z)) }
        : sp,
    );
  };
  // The previewed space (ADR-269) and the pinned one, each in its own dashed outline.
  const hoverBox = canHover && hoverId !== undefined ? selectionBox(model, hoverId) : undefined;
  const hoverName =
    hoverBox && hoverId !== undefined
      ? hoverId === null
        ? WHOLE_LABEL[design.product.kind]
        : nameOfSpace(design.product, hoverId)
      : null;
  const pinBox =
    pinnedId && !print && findInProduct(design.product, pinnedId)
      ? selectionBox(model, pinnedId)
      : undefined;

  // Quick counts (ADR-084) lie inside the drawing in the corner farthest from the selection and its size label
  // (ADR-112). Placed from the outline's screen box, so it follows zoom and resizes; it never changes the drawing.
  const figRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const selRef = useRef<SVGRectElement>(null);
  const selDimRef = useRef<SVGGElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [tick, setTick] = useState(0);
  useLayoutEffect(() => {
    const fig = figRef.current;
    if (!fig || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setTick((n) => n + 1));
    ro.observe(fig);
    return () => ro.disconnect();
  }, []);
  // The card is hidden while the phone sheet is open (it measures 0 then); placed again once it shows, so it never
  // lands past the drawing's right edge and scrolls the page sideways at 390 px.
  const hasCard = selectedSpace !== undefined;
  useLayoutEffect(() => {
    const st = stepRef.current;
    if (!st || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setTick((n) => n + 1));
    ro.observe(st);
    return () => ro.disconnect();
  }, [hasCard]);
  const sb = selectedSpace?.box;
  useLayoutEffect(() => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return;
    const next = Math.min(r.width / (b.w + 2 * pad), r.height / (b.h + 2 * pad * 1.4));
    setPxScale((p) => (Math.abs(p - next) < 0.001 ? p : next));
  }, [b.w, b.h, pad, tick]);
  useLayoutEffect(() => {
    const fig = figRef.current,
      sel = selRef.current,
      st = stepRef.current;
    if (!fig || !sel || !st) return setPos(null);
    // Hidden (display: none under the open phone sheet): keep the last place, as a width of 0 would put it past the edge.
    if (getComputedStyle(st).display === 'none') return;
    const f = fig.getBoundingClientRect();
    const next = cardCorner(f.width, f.height, st.offsetWidth, st.offsetHeight, [
      ...boxIn(f, sel, 4),
      ...boxIn(f, selDimRef.current, 2),
    ]);
    setPos((p) => (p && p.left === next.left && p.top === next.top ? p : next));
  }, [sb?.x, sb?.y, sb?.w, sb?.h, b.x, b.y, b.w, b.h, tick, design.product]);

  // In-space picks (ADR-286): placed over the selected space, in the figure's own pixels.
  const [pickBox, setPickBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const picksOn = canvas && selNode !== undefined && selNode.kind === 'empty';
  useLayoutEffect(() => {
    const fig = figRef.current,
      sel = selRef.current;
    if (!picksOn || !fig || !sel) return setPickBox(null);
    const [bx] = boxIn(fig.getBoundingClientRect(), sel);
    setPickBox((p) =>
      bx &&
      (!p ||
        p.left !== bx.left ||
        p.top !== bx.top ||
        p.width !== bx.width ||
        p.height !== bx.height)
        ? bx
        : (p ?? null),
    );
  }, [picksOn, sb?.x, sb?.y, sb?.w, sb?.h, b.x, b.y, b.w, b.h, tick, pxScale]);

  // The Parts lens (ADR-288): each front on the drawing shows its cut size, the same row the Parts list shows.
  const outLens = useOutLens();
  const tab = useDesign((st) => st.tab);
  const view = useView();
  const partSizes = useMemo(() => {
    if (!canvas || !outLens || tab !== 'parts') return [];
    const rowOf = new Map<string, { length: number; width: number }>();
    for (const r of view.cutRows) for (const id of r.panelIds) rowOf.set(id, r);
    return fronts.flatMap((p) => {
      const r = rowOf.get(p.id);
      return r ? [{ p, label: `${r.length}×${r.width}` }] : [];
    });
  }, [canvas, outLens, tab, view.cutRows, fronts]);

  // Problem pins (ADR-287): one per space a check names, error first; a tap opens a callout with the messages.
  const pins = useMemo(() => {
    if (!canvas) return [];
    const by = new Map<string, Diagnostic[]>();
    for (const d of model.diagnostics) {
      if (!d.nodeId || !model.spaces.some((o) => o.nodeId === d.nodeId && o.view !== 'side'))
        continue;
      by.set(d.nodeId, [...(by.get(d.nodeId) ?? []), d]);
    }
    return [...by].map(([nodeId, ds]) => ({
      nodeId,
      ds: [...ds].sort(
        (x, y) => (x.severity === 'error' ? -1 : 0) - (y.severity === 'error' ? -1 : 0),
      ),
      box: model.spaces.find((o) => o.nodeId === nodeId && o.view !== 'side')!.box,
    }));
  }, [canvas, model]);
  const [openPin, setOpenPin] = useState<{ nodeId: string; left: number; top: number } | null>(
    null,
  );
  const pinOpen = openPin ? pins.find((p) => p.nodeId === openPin.nodeId) : undefined;
  const setTab = useDesign((st) => st.setTab);
  const setMode = useUi((st) => st.setMode);

  // A tap anywhere selects from the outside in, one level per tap (ADR-083); leaves stay keyboard targets.
  const pointAt = (e: MouseEvent<SVGSVGElement>) => {
    const m = e.currentTarget.getScreenCTM();
    if (!m) return undefined;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: Math.round(p.x), y: Math.round(-p.y) };
  };
  // Ctrl or Cmd click jumps to the innermost space (ADR-269).
  const onTap = (e: MouseEvent<SVGSVGElement>) => {
    const at = pointAt(e);
    if (at) tapPiece(at.x, at.y, e.ctrlKey || e.metaKey, enteredId);
  };
  // A double click with a mouse enters the divided space under the pointer (ADR-270); a button does it on touch.
  const onDouble = (e: MouseEvent<SVGSVGElement>) => {
    if (!canHover) return;
    const at = pointAt(e);
    if (!at) return;
    const split = pathAt(model, at.x, at.y)
      .filter((id) => findInProduct(design.product, id)?.space.kind === 'split')
      .at(-1);
    if (!split) return;
    enter(split, design.id);
    select(split);
  };
  // What the next tap would select, outlined and named; nothing outside the piece.
  const onHover = (e: MouseEvent<SVGSVGElement>) => {
    if (!canHover) return;
    const at = pointAt(e);
    if (!at) return setHover(undefined);
    const deep = e.ctrlKey || e.metaKey;
    setHover(deep ? deepestAt(model, at.x, at.y) : drill(model, at.x, at.y, selectedId));
  };
  const leaves = model.spaces.filter((s) => s.leaf && s.view !== 'side');

  return (
    <figure
      ref={figRef}
      className="elevation"
      aria-label={t('Front view. Select a space to edit it.')}
    >
      <svg
        ref={svgRef}
        viewBox={vb}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        onClick={onTap}
        onDoubleClick={onDouble}
        style={{ '--focus-opacity': FOCUS_OPACITY[focusLook] } as CSSProperties}
        onMouseMove={canHover ? onHover : undefined}
        onMouseLeave={canHover ? () => setHover(undefined) : undefined}
      >
        <defs>
          {design.materials.flatMap((m) => {
            const url = m.image ? urls.get(m.image.id) : undefined;
            if (!m.image || !url || url === 'missing') return [];
            const { tileLength: L, tileWidth: W, id: imageId } = m.image;
            return [false, true].map((turned) => (
              <pattern
                key={`${m.id}-${turned}`}
                id={patId(m.id, turned)}
                patternUnits="userSpaceOnUse"
                width={L}
                height={W}
                patternTransform={turned ? 'rotate(90)' : undefined}
                data-image={imageId}
              >
                <image href={url} width={L} height={W} preserveAspectRatio="none" />
              </pattern>
            ));
          })}
        </defs>
        {/* A piece opened from a project with a room shows the wall behind it (ADR-208). */}
        <WallBehind b={b} />
        <rect className="floor" x={b.x - pad} y={0} width={b.w + 2 * pad} height={pad * 0.15} />
        {backs
          .filter((p) => shown(p.box))
          .map((p) => (
            <polygon key={p.id} className={`el-back${fade(p.box)}`} points={outlinePoints(p)} />
          ))}
        {leaves.map((s) => (
          <g
            key={s.nodeId}
            className={`el-space ${s.nodeId === selectedId ? 'selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={s.nodeId === selectedId}
            aria-label={t('{what} space, {w} by {h} mm', {
              what: describe(s, counts.get(s.nodeId)),
              w: s.box.w,
              h: s.box.h,
            })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey) {
                // Shift+Enter goes up one level, as Esc does (ADR-269).
                e.preventDefault();
                select(parentSel(model, s.nodeId));
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                tapPiece(
                  Math.round(boxCentre(s.box).x),
                  Math.round(boxCentre(s.box).y),
                  false,
                  enteredId,
                );
              }
            }}
          >
            <rect x={s.box.x} y={Y(s.box.y, s.box.h)} width={s.box.w} height={s.box.h} />
          </g>
        ))}
        {structure
          .filter((p) => shown(p.box))
          .map((p) => (
            <polygon
              key={p.id}
              className={`el-panel ${selectedPanels.has(p.id) ? 'hl' : ''}${fade(p.box)}`}
              points={outlinePoints(p)}
              style={{ fill: fillOf(p) }}
              data-plain={mats.get(p.materialId)?.color}
            />
          ))}
        {/* Fronts fill with their board's picture as carcass panels do, dashed outline kept (ADR-206). */}
        {showFronts &&
          fronts
            .filter((p) => shown(p.box))
            .map((p) => {
              const pic = pictureOf(p);
              return (
                <polygon
                  key={p.id}
                  className={`el-front${fade(p.box)}`}
                  points={outlinePoints(p)}
                  style={pic ? { fill: pic } : undefined}
                  data-plain={pic ? mats.get(p.materialId)?.color : undefined}
                />
              );
            })}
        {showFronts &&
          fronts
            .filter((p) => p.handleHoles && shown(p.box))
            .map((p) => {
              const pts = p.handleHoles!.at.map(([u, v]) => [p.box.x + u, -(p.box.y + v)] as const);
              return pts.length === 2 ? (
                <line
                  key={`h-${p.id}`}
                  className="el-handle"
                  x1={pts[0][0]}
                  y1={pts[0][1]}
                  x2={pts[1][0]}
                  y2={pts[1][1]}
                />
              ) : (
                <circle
                  key={`h-${p.id}`}
                  className="el-knob"
                  cx={pts[0][0]}
                  cy={pts[0][1]}
                  r={Math.max(b.w, b.h) / 160}
                />
              );
            })}
        {leaves
          .filter((s) => shown(s.box))
          .map((s) => (
            <text
              key={`l-${s.nodeId}`}
              className={`el-label ${s.nodeId === selectedId ? 'selected' : ''}${fade(s.box)}`}
              x={boxCentre(s.box).x}
              y={Y(s.box.y, s.box.h) + s.box.h / 2}
              fontSize={Math.max(Math.min(fontSize, s.box.w / 6), floorUnits)}
              dominantBaseline="middle"
              textAnchor="middle"
            >
              {describe(s, counts.get(s.nodeId), print)}
            </text>
          ))}
        {hoverBox && (
          <rect
            className="el-hover"
            x={hoverBox.x}
            y={Y(hoverBox.y, hoverBox.h)}
            width={hoverBox.w}
            height={hoverBox.h}
          />
        )}
        {pinBox && (
          <rect
            className="el-pinned"
            x={pinBox.x}
            y={Y(pinBox.y, pinBox.h)}
            width={pinBox.w}
            height={pinBox.h}
          />
        )}
        {selectedSpace && (
          <rect
            ref={selRef}
            className="el-selection"
            x={selectedSpace.box.x}
            y={Y(selectedSpace.box.y, selectedSpace.box.h)}
            width={selectedSpace.box.w}
            height={selectedSpace.box.h}
          />
        )}
        <Dim
          x1={b.x}
          x2={b.x + b.w}
          y={pad * 0.75}
          fontSize={fontSize}
          label={`${b.w}`}
          tag={wholeTag('Width', b.w)}
        />
        <DimV
          y1={0}
          y2={-(b.y + b.h)}
          x={b.x - pad * 0.55}
          fontSize={fontSize}
          label={`${b.h}`}
          tag={wholeTag('Height', b.h)}
        />
        {canvas && (
          // At the right end of the overall width line, clear of the selected space's size above the piece.
          <TagPill
            x={b.x + b.w}
            y={pad * 0.75}
            fontSize={fontSize * 0.85}
            label={t('D {n}', { n: b.d })}
            tag={wholeTag('Depth', b.d)!}
          />
        )}
        {selectedSpace && selectedId !== null && (
          <g ref={selDimRef}>
            <Dim
              x1={selectedSpace.box.x}
              x2={selectedSpace.box.x + selectedSpace.box.w}
              y={-(b.y + b.h) - pad * 0.45}
              fontSize={fontSize * 0.85}
              label={`${selectedSpace.box.w}`}
              subtle
              tag={
                partAxis === 'x'
                  ? partTag(t('Width {n} mm', { n: selectedSpace.box.w }))
                  : undefined
              }
            />
            {partAxis === 'y' && (
              <DimV
                y1={Y(selectedSpace.box.y, selectedSpace.box.h)}
                y2={Y(selectedSpace.box.y, selectedSpace.box.h) + selectedSpace.box.h}
                x={b.x + b.w + pad * 0.45}
                fontSize={fontSize * 0.85}
                label={`${selectedSpace.box.h}`}
                subtle
                tag={partTag(t('Height {n} mm', { n: selectedSpace.box.h }))}
              />
            )}
          </g>
        )}
        {canvas && selNode && selNode.kind !== 'split' && selectedSpace && (
          <>
            <PlusHandle
              x={selectedSpace.box.x + selectedSpace.box.w}
              y={
                Y(selectedSpace.box.y, selectedSpace.box.h) +
                Math.min(selectedSpace.box.h * 0.2, hit * 1.2)
              }
              r={hit / 2}
              name={t('Divide side by side')}
              onActivate={() => updateSpace(selNode.id, (sp) => splitSpace(sp, 'x', 2))}
            />
            <PlusHandle
              x={selectedSpace.box.x + Math.min(selectedSpace.box.w * 0.25, hit * 1.2)}
              y={Y(selectedSpace.box.y, selectedSpace.box.h) + selectedSpace.box.h}
              r={hit / 2}
              name={t('Divide stacked')}
              onActivate={() => updateSpace(selNode.id, (sp) => splitSpace(sp, 'y', 2))}
            />
          </>
        )}
        {canvas &&
          barSplit?.kind === 'split' &&
          barBoxes.slice(0, -1).map((a, i) => {
            const bx = barBoxes[i + 1];
            if (!a || !bx) return null;
            return (
              <DividerBar
                key={`${barSplit.id}-${i}`}
                axis={barSplit.axis}
                a={a}
                b={bx}
                hit={hit}
                fontSize={fontSize}
                pxScale={pxScale}
                index={i}
                count={barBoxes.length - 1}
                drag={barDrag?.i === i ? barDrag.value : null}
                onDrag={(value) => setBarDrag(value === null ? null : { i, value })}
                onCommit={(value) => {
                  setBarDrag(null);
                  commitBar(i, value);
                }}
              />
            );
          })}
        {partSizes.map(({ p, label }) => {
          const fs = fontSize * 0.75;
          const w = label.length * fs * 0.6 + fs;
          const cx = boxCentre(p.box).x,
            cy = Y(p.box.y, p.box.h) + p.box.h / 2;
          return (
            <g key={`size-${p.id}`} className="part-size" aria-hidden="true">
              <rect x={cx - w / 2} y={cy - fs * 0.7} width={w} height={fs * 1.4} rx={fs * 0.2} />
              <text x={cx} y={cy} fontSize={fs} textAnchor="middle" dominantBaseline="central">
                {label}
              </text>
            </g>
          );
        })}
        {pins.map((p) => {
          const r = hit / 2;
          const cx = p.box.x + Math.min(r, p.box.w / 2);
          const cy = Y(p.box.y, p.box.h) + Math.min(r, p.box.h / 2);
          const error = p.ds[0].severity === 'error';
          return (
            <g
              key={p.nodeId}
              className={`problem-pin ${error ? 'error' : 'warning'}`}
              role="button"
              tabIndex={0}
              aria-label={p.ds
                .map((d) =>
                  d.severity === 'error'
                    ? t('Problem: {message}', { message: d.message })
                    : t('Check: {message}', { message: d.message }),
                )
                .join(' ')}
              onClick={(e) => {
                e.stopPropagation();
                const f = figRef.current?.getBoundingClientRect();
                const g = (e.currentTarget as Element).getBoundingClientRect();
                setOpenPin(
                  f
                    ? {
                        nodeId: p.nodeId,
                        left: Math.max(4, Math.min(g.left - f.left, f.width - 284)),
                        top: g.bottom - f.top + 4,
                      }
                    : null,
                );
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                const f = figRef.current?.getBoundingClientRect();
                const g = (e.currentTarget as Element).getBoundingClientRect();
                setOpenPin(
                  f
                    ? {
                        nodeId: p.nodeId,
                        left: Math.max(4, Math.min(g.left - f.left, f.width - 284)),
                        top: g.bottom - f.top + 4,
                      }
                    : null,
                );
              }}
            >
              <circle className="pin-hit" cx={cx} cy={cy} r={r} />
              <circle className="pin-dot" cx={cx} cy={cy} r={r * 0.55} />
              <text x={cx} y={cy} fontSize={r * 0.8} textAnchor="middle" dominantBaseline="central">
                !
              </text>
            </g>
          );
        })}
      </svg>
      {pinOpen && openPin && (
        <div
          className="pin-callout"
          role="dialog"
          aria-label={t('Problem and repairs')}
          style={{
            left: openPin.left,
            top: openPin.top,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpenPin(null);
            }
          }}
        >
          {pinOpen.ds.map((d, i) => (
            <p key={i} className={`pin-msg ${d.severity}`}>
              <strong>{d.severity === 'error' ? t('Problem') : t('Check')}</strong> {d.message}
            </p>
          ))}
          <div className="pin-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setOpenPin(null);
                setMode('build');
                setTab('checks');
              }}
            >
              {t('Open Checks')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                select(pinOpen.nodeId);
                setOpenPin(null);
              }}
            >
              {t('Select it')}
            </button>
            <button type="button" className="btn ghost" onClick={() => setOpenPin(null)}>
              {t('Close')}
            </button>
          </div>
        </div>
      )}
      {hoverName && (
        <span className="el-chip" aria-hidden="true">
          {hoverName}
        </span>
      )}
      {picksOn && pickBox && selNode && (
        <div
          className="space-picks"
          role="group"
          aria-label={t('Fill this space')}
          style={{
            left: pickBox.left,
            top: pickBox.top,
            width: pickBox.width,
            height: pickBox.height,
          }}
        >
          {(['shelves', 'drawers', 'hanging'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className="btn pick"
              onClick={() => updateSpace(selNode.id, (sp) => changeKind(sp, k))}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
          <button
            type="button"
            className="btn pick"
            aria-pressed={!!selNode.front}
            onClick={() =>
              updateSpace(selNode.id, (sp) => ({
                ...sp,
                front: sp.front ? null : { kind: 'doors', count: 1 },
              }))
            }
          >
            {t('Door')}
          </button>
        </div>
      )}
      {selectedSpace && (
        <CountStepper
          ref={stepRef}
          className="floating"
          compact
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
        />
      )}
    </figure>
  );
}

/**
 * One piece's front view from its own model (ADR-185): the printed assembly sheet draws it in each piece's section,
 * for a design and for every piece of a project. Drawn like the editor's (structure solid in its board colours, the
 * back behind, fronts dashed, handles, overall width and height); nothing to tap or select. Geometry comes from the
 * model only (ADR-004).
 */
export function PieceElevation({
  model,
  materials,
  label,
}: {
  model: FurnitureModel;
  materials: Material[];
  label: string;
}) {
  const mats = new Map(materials.map((m) => [m.id, m]));
  const b = model.bounds;
  const pad = Math.max(b.w, b.h) * 0.09;
  const vb = `${b.x - pad} ${-(b.y + b.h) - pad} ${b.w + 2 * pad} ${b.h + 2 * pad * 1.4}`;
  const fontSize = Math.max(b.w, b.h) / 26;
  const BEHIND = new Set<Panel['role']>(['back', 'modesty']);
  const structure = model.panels.filter(
    (p) => !FRONT_ROLES.has(p.role) && !DRAWER_BOX_ROLES.has(p.role) && !BEHIND.has(p.role),
  );
  const backs = model.panels.filter((p) => BEHIND.has(p.role));
  const fronts = model.panels.filter((p) => FRONT_ROLES.has(p.role));
  return (
    <figure className="elevation piece-elevation" aria-label={label}>
      <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
        <rect className="floor" x={b.x - pad} y={0} width={b.w + 2 * pad} height={pad * 0.15} />
        {backs.map((p) => (
          <polygon key={p.id} className="el-back" points={outlinePoints(p)} />
        ))}
        {structure.map((p) => (
          <polygon
            key={p.id}
            className="el-panel"
            points={outlinePoints(p)}
            style={{ fill: mats.get(p.materialId)?.color }}
          />
        ))}
        {fronts.map((p) => (
          <polygon key={p.id} className="el-front" points={outlinePoints(p)} />
        ))}
        {fronts
          .filter((p) => p.handleHoles)
          .map((p) => {
            const pts = p.handleHoles!.at.map(([u, v]) => [p.box.x + u, -(p.box.y + v)] as const);
            return pts.length === 2 ? (
              <line
                key={`h-${p.id}`}
                className="el-handle"
                x1={pts[0][0]}
                y1={pts[0][1]}
                x2={pts[1][0]}
                y2={pts[1][1]}
              />
            ) : (
              <circle
                key={`h-${p.id}`}
                className="el-knob"
                cx={pts[0][0]}
                cy={pts[0][1]}
                r={Math.max(b.w, b.h) / 160}
              />
            );
          })}
        <Dim x1={b.x} x2={b.x + b.w} y={pad * 0.75} fontSize={fontSize} label={`${b.w}`} />
        <DimV y1={0} y2={-(b.y + b.h)} x={b.x - pad * 0.55} fontSize={fontSize} label={`${b.h}`} />
      </svg>
    </figure>
  );
}

/**
 * A size label that is also a button (the canvas editor's size tags, ADR-284): its name for assistive tech, what a tap
 * does, and the hit size in drawing units (44 px at the current scale).
 */
interface DimTag {
  name: string;
  onActivate: () => void;
  hit: number;
}

/** Button props for a size tag: a tap or Enter / Space activates it. */
function tagProps(tag: DimTag | undefined) {
  if (!tag) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': tag.name,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      tag.onActivate();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tag.onActivate();
      }
    },
  };
}

export function Dim({
  x1,
  x2,
  y,
  label,
  fontSize,
  subtle,
  tag,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
  fontSize: number;
  subtle?: boolean;
  tag?: DimTag;
}) {
  const mid = (x1 + x2) / 2;
  const w = label.length * fontSize * 0.62 + fontSize;
  return (
    <g className={`dim ${subtle ? 'subtle' : ''}${tag ? ' tag' : ''}`} {...tagProps(tag)}>
      {tag && (
        <rect
          className="dim-hit"
          x={mid - Math.max(w, tag.hit) / 2}
          y={y - Math.max(fontSize * 1.4, tag.hit) / 2}
          width={Math.max(w, tag.hit)}
          height={Math.max(fontSize * 1.4, tag.hit)}
        />
      )}
      <line x1={x1} x2={x2} y1={y} y2={y} />
      <line x1={x1} x2={x1} y1={y - fontSize * 0.4} y2={y + fontSize * 0.4} />
      <line x1={x2} x2={x2} y1={y - fontSize * 0.4} y2={y + fontSize * 0.4} />
      <rect
        x={mid - w / 2}
        y={y - fontSize * 0.7}
        width={w}
        height={fontSize * 1.4}
        rx={fontSize * 0.2}
      />
      <text x={mid} y={y} fontSize={fontSize} textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
    </g>
  );
}

/** A size tag with no dimension line, its right edge at `x` (the depth, which the front view cannot draw, ADR-284). */
function TagPill({
  x,
  y,
  label,
  fontSize,
  tag,
}: {
  x: number;
  y: number;
  label: string;
  fontSize: number;
  tag: DimTag;
}) {
  const w = label.length * fontSize * 0.62 + fontSize;
  const cx = x - w / 2;
  return (
    <g className="dim subtle tag" {...tagProps(tag)}>
      <rect
        className="dim-hit"
        x={cx - Math.max(w, tag.hit) / 2}
        y={y - Math.max(fontSize * 1.4, tag.hit) / 2}
        width={Math.max(w, tag.hit)}
        height={Math.max(fontSize * 1.4, tag.hit)}
      />
      <rect
        x={cx - w / 2}
        y={y - fontSize * 0.7}
        width={w}
        height={fontSize * 1.4}
        rx={fontSize * 0.2}
      />
      <text x={cx} y={y} fontSize={fontSize} textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
    </g>
  );
}

export function DimV({
  y1,
  y2,
  x,
  label,
  fontSize,
  subtle,
  tag,
}: {
  y1: number;
  y2: number;
  x: number;
  label: string;
  fontSize: number;
  subtle?: boolean;
  tag?: DimTag;
}) {
  const mid = (y1 + y2) / 2;
  const w = label.length * fontSize * 0.62 + fontSize;
  return (
    <g className={`dim ${subtle ? 'subtle' : ''}${tag ? ' tag' : ''}`} {...tagProps(tag)}>
      {tag && (
        <rect
          className="dim-hit"
          x={x - Math.max(fontSize * 1.4, tag.hit) / 2}
          y={mid - Math.max(w, tag.hit) / 2}
          width={Math.max(fontSize * 1.4, tag.hit)}
          height={Math.max(w, tag.hit)}
        />
      )}
      <line x1={x} x2={x} y1={y1} y2={y2} />
      <line x1={x - fontSize * 0.4} x2={x + fontSize * 0.4} y1={y1} y2={y1} />
      <line x1={x - fontSize * 0.4} x2={x + fontSize * 0.4} y1={y2} y2={y2} />
      <g transform={`rotate(-90 ${x} ${mid})`}>
        <rect
          x={x - w / 2}
          y={mid - fontSize * 0.7}
          width={w}
          height={fontSize * 1.4}
          rx={fontSize * 0.2}
        />
        <text x={x} y={mid} fontSize={fontSize} textAnchor="middle" dominantBaseline="central">
          {label}
        </text>
      </g>
    </g>
  );
}

/** A green + on a space's edge that divides it (ADR-285): side by side from the right edge, stacked from the bottom. */
function PlusHandle({
  x,
  y,
  r,
  name,
  onActivate,
}: {
  x: number;
  y: number;
  r: number;
  name: string;
  onActivate: () => void;
}) {
  const arm = r * 0.45;
  return (
    <g
      className="plus-handle"
      role="button"
      tabIndex={0}
      aria-label={name}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <circle className="plus-hit" cx={x} cy={y} r={r} />
      <circle className="plus-dot" cx={x} cy={y} r={r * 0.62} />
      <path d={`M${x - arm} ${y}H${x + arm}M${x} ${y - arm}V${y + arm}`} />
    </g>
  );
}

/**
 * The size a part gets when the divider after it is moved from `start` to `to` along the split (ADR-285): it grows by
 * the move when it lies on the low side of the divider. Whole millimetres, 10 mm steps with snap, never below 1.
 */
export function partSizeAfterMove(
  size: number,
  partIsLow: boolean,
  start: number,
  to: number,
  snap: boolean,
) {
  const raw = size + (partIsLow ? to - start : start - to);
  const v = snap ? Math.round(raw / 10) * 10 : Math.round(raw);
  return Math.max(1, v);
}

/**
 * The divider between two parts of a split (ADR-285): drag it to size the part before it (a fixed size, one undo step
 * on release), or focus it and use ← → / ↑ ↓ for 10 mm steps. The size tag (ADR-284) types the same size.
 */
function DividerBar({
  axis,
  a,
  b,
  hit,
  fontSize,
  pxScale,
  index,
  count,
  drag,
  onDrag,
  onCommit,
}: {
  axis: 'x' | 'y';
  a: { x: number; y: number; w: number; h: number };
  b: { x: number; y: number; w: number; h: number };
  hit: number;
  fontSize: number;
  pxScale: number;
  index: number;
  count: number;
  drag: number | null;
  onDrag: (value: number | null) => void;
  onCommit: (value: number) => void;
}) {
  const across = axis === 'x';
  // Part `a` is on the low side when it starts first along the axis (left, or lower in the front view).
  const aLow = across ? a.x <= b.x : a.y <= b.y;
  const size = across ? a.w : a.h;
  const lo = aLow ? a : b,
    hi = aLow ? b : a;
  // The divider's line, in model coordinates along the axis, and its span across.
  const at = across ? (lo.x + lo.w + hi.x) / 2 : (lo.y + lo.h + hi.y) / 2;
  const shown = drag ?? size;
  const pos = drag === null ? at : at + (aLow ? drag - size : size - drag);
  const start = useRef<{ client: number; snap: boolean } | null>(null);
  const toValue = (client: number) => {
    const s = start.current!;
    const moved = (client - s.client) / (pxScale || 1);
    return partSizeAfterMove(size, aLow, at, at + (across ? moved : -moved), s.snap);
  };
  const x1 = across ? pos : Math.min(a.x, b.x);
  const x2 = across ? pos : Math.max(a.x + a.w, b.x + b.w);
  const y1 = across ? -Math.max(a.y + a.h, b.y + b.h) : -pos;
  const y2 = across ? -Math.min(a.y, b.y) : -pos;
  return (
    <g
      className={`divider-bar${drag !== null ? ' dragging' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label={t('Divider {i} of {n}', { i: index + 1, n: count })}
      aria-valuenow={shown}
      aria-valuetext={t('{n} mm', { n: shown })}
      aria-orientation={across ? 'horizontal' : 'vertical'}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        start.current = { client: across ? e.clientX : e.clientY, snap: snapIsOn() && !e.altKey };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        onDrag(toValue(across ? e.clientX : e.clientY));
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        const v = toValue(across ? e.clientX : e.clientY);
        start.current = null;
        if (v !== size) onCommit(v);
        else onDrag(null);
      }}
      onPointerCancel={() => {
        start.current = null;
        onDrag(null);
      }}
      onKeyDown={(e) => {
        const grow = across ? 'ArrowRight' : 'ArrowUp';
        const shrink = across ? 'ArrowLeft' : 'ArrowDown';
        if (e.key !== grow && e.key !== shrink) return;
        e.preventDefault();
        const step = (e.key === grow) === aLow ? 10 : -10;
        onCommit(Math.max(1, size + step));
      }}
    >
      <line className="divider-hit" x1={x1} x2={x2} y1={y1} y2={y2} strokeWidth={hit} />
      <line className="divider-line" x1={x1} x2={x2} y1={y1} y2={y2} />
      {drag !== null && (
        <text
          className="divider-readout"
          x={across ? pos : (x1 + x2) / 2}
          y={across ? (y1 + y2) / 2 : -pos - fontSize}
          fontSize={fontSize}
          textAnchor="middle"
        >
          {t('{n} mm', { n: drag })}
        </text>
      )}
    </g>
  );
}
