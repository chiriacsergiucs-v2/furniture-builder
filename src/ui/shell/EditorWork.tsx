import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t, tr } from '@furniture-builder/i18n';
import type { Tab } from '../../store/designState';
import { useDesign } from '../../store/designStore';
import { usePieceList } from '../../store/pieceListStore';
import { useProblem } from '../../store/problemStore';
import { useCanvasEditor } from '../../store/useCanvasEditor';
import { setLook, useLook } from '../../store/useLook';
import { useMediaQuery } from '../../store/useMediaQuery';
import { takeKeepSheetClosed, useUi } from '../../store/uiStore';
import { useViewStore } from '../../store/viewStore';
import {
  EditBar,
  LadderPill,
  LensHead,
  scrollToBlock,
  setOutLens,
  useKeyboardInset,
  useLens,
  useLensAnchor,
  useLensHeight,
  useLensRequests,
  type Crumb,
} from '../CanvasEditor';
import { Section, rovingKeys, rovingTab } from '../controls';
import { Elevation } from '../Elevation';
import { CanvasHints, FindAction } from '../FindAction';
import { Icon } from '../icons';
import { Inspector, selectionChain, selectionLabel } from '../Inspector';
import { Output } from '../Output';
import { PieceList } from '../PieceList';
import { PeekActions, PlanView, ProjectPanel } from '../Project';
import { SheetHandle, type SheetStop } from '../SheetHandle';
import {
  bringDrawingForward,
  defaultView,
  inOptions,
  shows3d,
  showsDrawing,
  viewOptions,
  type StageView,
} from '../viewChoice';
import { ViewOptions } from '../ViewOptions';
import { useCheckCounts } from './checkCounts';
import { EstimateChip } from './EstimateChip';
import { useCardHistory } from './useCardHistory';
import { ViewerSlot, webglAvailable } from './ViewerSlot';

// The heavy children read the store themselves and take only stable props: the editor's own re-renders (the sheet,
// the selection text, the cards) pass them by (G-500).
const PanelInspector = memo(Inspector);
const PanelProject = memo(ProjectPanel);
const DrawingPlan = memo(PlanView);
const DrawingFront = memo(Elevation);
const Results = memo(Output);

/** The view switch and the view tools above the drawing (ADR-081, ADR-144). */
function StageTools({
  shown,
  setView,
  has3d,
  frontsInPlan,
  compact,
  mount3d,
  onRender,
}: {
  shown: StageView;
  setView: (v: StageView) => void;
  has3d: boolean;
  frontsInPlan: boolean;
  compact: boolean;
  mount3d: boolean;
  onRender: () => void;
}) {
  const showFronts = useDesign((s) => s.showFronts);
  const setShowFronts = useDesign((s) => s.setShowFronts);
  const exploded = useDesign((s) => s.exploded);
  const setExploded = useDesign((s) => s.setExploded);
  const requestFit = useViewStore((s) => s.requestFit);
  const look = useLook();
  return (
    <div className="stage-tools">
      <div
        className="segmented small"
        role="radiogroup"
        aria-label={t('View')}
        onKeyDown={rovingKeys}
      >
        {viewOptions(has3d).map((o, i, all) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={shown === o.id}
            tabIndex={rovingTab(
              shown === o.id,
              i,
              all.some((x) => x.id === shown),
            )}
            className={shown === o.id ? 'on' : ''}
            disabled={o.disabled}
            title={o.reason}
            aria-describedby={o.reason ? 'no-3d-why' : undefined}
            onClick={() => setView(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {/* Why 3D is off, as visible text beside the switch (ADR-081, ADR-259). */}
      {!has3d && (
        <p id="no-3d-why" className="hint">
          {t(
            '3D preview is not available in this browser. The front view and parts list still work.',
          )}
        </p>
      )}
      {/* Fronts stays in the row on a phone too (G-269); the other tools go behind Options there. */}
      {!frontsInPlan && (
        <label className="toggle small">
          <input
            type="checkbox"
            aria-label={t('Doors and fronts')}
            checked={showFronts}
            onChange={(e) => setShowFronts(e.target.checked)}
          />
          <span className="fronts-long">{t('Doors and fronts')}</span>
          <span className="fronts-short">{t('Fronts')}</span>
        </label>
      )}
      <ViewOptions menu={inOptions('exploded', compact)}>
        {shows3d(shown) && (
          <label className="toggle small">
            <input
              type="checkbox"
              checked={exploded}
              onChange={(e) => setExploded(e.target.checked)}
            />
            <span>{t('Exploded 3D')}</span>
          </label>
        )}
        {shows3d(shown) && (
          <button type="button" className="btn sm" onClick={requestFit}>
            <Icon name="refresh" className="sm" />
            {t('Reset view')}
          </button>
        )}
        {mount3d && (
          <div
            className="segmented small"
            role="radiogroup"
            aria-label={t('Look')}
            onKeyDown={rovingKeys}
          >
            {(['simple', 'realistic'] as const).map((l, i) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={look === l}
                tabIndex={rovingTab(look === l, i, true)}
                className={look === l ? 'on' : ''}
                onClick={() => setLook(l)}
              >
                {l === 'simple' ? t('Simple') : t('Realistic')}
              </button>
            ))}
          </div>
        )}
        {mount3d && (
          <button
            type="button"
            className="btn sm"
            title={t('Render a photo-quality picture. Best on a laptop; a phone may be slow.')}
            onClick={onRender}
          >
            <Icon name="camera" className="sm" />
            {t('Render')}
          </button>
        )}
      </ViewOptions>
    </div>
  );
}

/**
 * The editor page (moved out of App, G-500): the Compose panel, the stage with its drawing and 3D view, the results,
 * and on a phone the sheet or the canvas editor's cards. It stays mounted, hidden, on the other pages.
 */
export function EditorWork({
  active,
  onRender,
  onCatalog,
  onWizardToProject,
}: {
  /** The editor is the page shown. */
  active: boolean;
  onRender: () => void;
  onCatalog: () => void;
  onWizardToProject: () => void;
}) {
  const designProduct = useDesign((s) => s.design.product);
  const designName = useDesign((s) => s.design.name);
  const project = useDesign((s) => s.project);
  const editingItemId = useDesign((s) => s.editingItemId);
  const selectedId = useDesign((s) => s.selectedId);
  const drillItemId = useDesign((s) => s.drillItemId);
  const selectedItemId = useDesign((s) => s.selectedItemId);
  const selectedCount = useDesign((s) => s.selectedItemIds.length);
  const inProject = !!project && !editingItemId;

  // Editor modes (ADR-079, ADR-080). Build & Preview shows 3D; Compose shows the drawing; Settings is a dialog.
  const mode = useUi((s) => s.mode);
  const setMode = useUi((s) => s.setMode);
  const phone = useMediaQuery('(max-width: 760px)');
  // A short screen wider than a phone (844 × 390 landscape, a short desktop window, ADR-295): the view tools go behind
  // Options as on a phone, so the tool row stays one row and the 3D view keeps its height, with no sideways scroll.
  const short = useMediaQuery('(min-width: 761px) and (max-height: 500px)');
  // The phone's slot for the 3D view's quick-count card (G-070), handed to the viewer (ADR-230).
  const [countDock, setCountDock] = useState<HTMLDivElement | null>(null);
  // Seams and lit parts the 3D view draws (ADR-230), shown as data attributes for the find-it scripts.
  const seams = useViewStore((s) => s.seams);
  const lit = useViewStore((s) => s.lit);
  const wide = useMediaQuery('(min-width: 1500px)');
  const [has3d] = useState(webglAvailable);
  // The View switch (ADR-081, ADR-144): 2D · 3D · Both, the same in both modes. The choice stays when the mode
  // changes (G-266); only crossing 1500 px starts again from the default (G-268).
  const [view, setView] = useState<StageView>(() => defaultView(wide, has3d));
  const [lastWide, setLastWide] = useState(wide);
  // The phone Compose sheet's stop (ADR-211, G-027): peek, half (today's open sheet) or full.
  const [sheetStop, setSheetStop] = useState<SheetStop>('peek');
  const sheetOpen = sheetStop !== 'peek';
  // The canvas editor (ADR-283, ADR-295): on a phone, behind a device flag, the sheet becomes a card that shows the
  // whole editor of the selection, opened from the edit bar; a selection ladder replaces the peek row.
  const [canvasFlag] = useCanvasEditor();
  const canvas = canvasFlag && phone;
  const workRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const sideBodyRef = useRef<HTMLDivElement>(null);
  const lensKeyList = useLens(sideBodyRef, canvas);
  // Scrolls the panel to a block once it shows (ADR-295); `then` runs after, e.g. to focus a field in it.
  const scrollWhenShown = (key: string, then?: (body: HTMLElement) => boolean) => {
    let tries = 0;
    const go = () => {
      const body = sideBodyRef.current;
      const ready = !!body && body.offsetParent !== null;
      if (ready && scrollToBlock(body, key) && (!then || then(body))) return;
      if (tries++ < 20) requestAnimationFrame(go);
    };
    requestAnimationFrame(go);
  };
  const stageRef = useRef<HTMLElement>(null);
  useLensHeight(sideRef, workRef, canvas && sheetOpen);
  useLensAnchor(sideRef, stageRef, canvas && sheetOpen);
  useKeyboardInset(workRef, canvas);
  // Output lenses (ADR-288): the results shown as a card over the drawing, opened from the panel's Results block.
  const [outOpen, setOutOpen] = useState(false);
  // A size tag on the drawing (ADR-284): open the card, scroll to its block and focus the field, once the editor shows it.
  useLensRequests((req) => {
    if (!canvas) return;
    setOutOpen(false);
    if (sheetStop === 'peek' || (req.showDrawing && sheetStop === 'full')) setSheetStop('half');
    scrollWhenShown(req.tab, (body) => {
      if (!req.focus) return true;
      const el = req.focus(body);
      if (!el || el.offsetParent === null) return false;
      el.focus();
      return true;
    });
  });
  // Find an action (ADR-289).
  const [findOpen, setFindOpen] = useState(false);
  const openOutput = (tab: Tab) => {
    useDesign.getState().setTab(tab);
    setSheetStop('peek');
    setOutOpen(true);
  };
  const outLensOn = canvas && outOpen && mode === 'compose';
  // The canvas editor's stage in Compose: ladder, view tools, the view, the docked counts and the edit bar (ADR-295).
  const canvasStage = canvas && mode === 'compose';
  const resultsRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    resultsRef.current = workRef.current?.querySelector<HTMLElement>('.output') ?? null;
  });
  useLensHeight(resultsRef, workRef, outLensOn);
  useEffect(() => setOutLens(outLensOn), [outLensOn]);
  const outputs: [Tab, string][] = [
    ['parts', t('Parts')],
    ['sheets', t('Sheets')],
    ['hardware', t('Hardware')],
    ['assembly', t('Assembly')],
    ['shopping', t('Shopping')],
  ];
  // Esc closes the open card before it goes up a level (ADR-283); captured first, so the level stays.
  useEffect(() => {
    if (!canvas || (!sheetOpen && !outOpen)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]'))
        return;
      e.preventDefault();
      setSheetStop('peek');
      setOutOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [canvas, sheetOpen, outOpen]);
  // Back closes the open card (ADR-295).
  const cardUp = canvas && mode === 'compose' && (sheetOpen || outOpen);
  useCardHistory(cardUp, () => {
    setSheetStop('peek');
    setOutOpen(false);
  });
  const checkErrors = useCheckCounts().errors;
  const pickLens = (k: string) => {
    setOutOpen(false);
    if (sheetStop === 'peek') setSheetStop('half');
    scrollWhenShown(k);
  };
  // Edit this piece asks for the full sheet in the project (ADR-241).
  const sheetAsk = useUi((s) => s.sheetAsk);
  const [lastAsk, setLastAsk] = useState(sheetAsk);
  if (sheetAsk !== lastAsk) {
    setLastAsk(sheetAsk);
    if (sheetAsk) setSheetStop(sheetAsk.stop);
  }
  const setSheetOpen = (open: boolean) => setSheetStop(open ? 'half' : 'peek');
  if (wide !== lastWide) {
    setLastWide(wide);
    setView(defaultView(wide, has3d));
  }
  // 3D mounts only while 3D or Both is shown, in either mode, phone included (ADR-014, G-267).
  const shown = view;
  // A project's drawing has its own tool row (Snap, Select, Clearances): Doors and fronts joins it there (ADR-109).
  const frontsInPlan = inProject && mode === 'compose' && showsDrawing(shown);
  // Mounted only while the editor is the page shown (ADR-014): hidden on Projects or Catalog it kept rendering.
  const mount3d = has3d && shows3d(shown) && active;

  // The piece list beside the plan (ADR-094): opened by Add a piece in Compose, only while the project is shown.
  const piecesOpen = usePieceList((s) => s.open);
  const setPiecesOpen = usePieceList((s) => s.setOpen);
  const piecesShown = piecesOpen && inProject && mode === 'compose' && active;
  useEffect(() => {
    if (piecesOpen && !(inProject && mode === 'compose')) setPiecesOpen(false);
  }, [piecesOpen, inProject, mode, setPiecesOpen]);
  // Stable, so the memoised project panel is passed by when the editor re-renders (G-500).
  const openPieces = useCallback(() => {
    setPiecesOpen(true);
    // Items are dropped on the plan: it comes forward, and on a phone the Compose sheet steps aside.
    setView(bringDrawingForward);
    setSheetStop('peek');
  }, [setPiecesOpen]);

  // A piece waiting to be placed (ADR-056) or a room being drawn (ADR-059) is done on the plan, in Compose.
  const tapMode = useDesign((s) =>
    s.placingItemId ? `place:${s.placingItemId}` : s.drawingRoom ? 'draw' : '',
  );
  // Choosing a piece or a space opens the phone sheet to half so its editor shows (user 2026-11-14, replaces the
  // 2026-11-09 peek-only rule).
  const selKey = inProject ? selectedItemId : selectedId;
  const [lastTap, setLastTap] = useState(tapMode);
  const [lastSel, setLastSel] = useState(selKey);
  if (tapMode !== lastTap) {
    setLastTap(tapMode);
    // Placing a piece or drawing the room needs the plan: on a phone the sheet steps aside.
    if (tapMode) {
      setView(bringDrawingForward);
      setSheetOpen(false);
    }
  }
  if (selKey !== lastSel) {
    setLastSel(selKey);
    // Choosing something opens the edit sheet to half; a peek-row action (duplicate) asks to keep it closed once.
    const keepClosed = takeKeepSheetClosed();
    // The canvas editor opens its card from a chip, never on a tap of the drawing (ADR-283).
    if (
      !canvas &&
      selKey !== null &&
      selKey !== undefined &&
      !keepClosed &&
      !tapMode &&
      sheetStop === 'peek'
    )
      setSheetStop('half');
  }
  // A project check tapped under Checks (ADR-071) is shown on the plan: the drawing comes forward, the sheet steps aside.
  const problemTap = useProblem((s) => s.tapped);
  const [lastProblemTap, setLastProblemTap] = useState(problemTap);
  if (problemTap !== lastProblemTap) {
    setLastProblemTap(problemTap);
    if (inProject) {
      setView(bringDrawingForward);
      setSheetOpen(false);
    }
  }
  useEffect(() => {
    if (tapMode) useUi.getState().setMode('compose');
  }, [tapMode]);

  const selectedItem = project?.items.find((i) => i.id === selectedItemId);
  const selectedModel = project?.models?.find((m) => m.id === selectedItemId);
  // Inside a project piece (ADR-088) the peek row names the level reached too: "Wardrobe › Hanging".
  const drillLevel =
    inProject && selectedItem && drillItemId === selectedItem.id && typeof selectedId === 'string'
      ? selectionLabel(designProduct, selectedId)
      : null;
  const peek = inProject
    ? selectedCount > 1
      ? t('{n} pieces selected', { n: selectedCount })
      : selectedItem || selectedModel
        ? t('Selected: {name}', {
            // Built-in names in the user's language (ADR-265).
            name: drillLevel
              ? `${tr(selectedItem!.design.name)} › ${drillLevel}`
              : tr(String(selectedItem?.design.name ?? selectedModel?.name)),
          })
        : t('{name}: {n|# piece|# pieces}', { name: tr(project!.name), n: project!.items.length })
    : (() => {
        const l = selectionLabel(designProduct, selectedId);
        return l ? t('Selected: {name}', { name: l }) : t('Tap a space to edit it');
      })();

  // The selection ladder (ADR-283): every level from the project or piece down to the selection, as the breadcrumb.
  const dsel = useDesign.getState;
  const inside: Crumb[] = selectionChain(designProduct, selectedId).map((c) => ({
    label: c.label,
    go: () => dsel().select(c.id),
  }));
  const crumbs: Crumb[] = inProject
    ? [
        { label: tr(project!.name), go: () => dsel().selectItem(null) },
        ...(selectedCount > 1
          ? [{ label: t('{n} pieces selected', { n: selectedCount }), go: () => {} }]
          : selectedItem || selectedModel
            ? [
                {
                  label: tr(String(selectedItem?.design.name ?? selectedModel?.name)),
                  go: () => dsel().select(null),
                },
                ...(drillLevel ? inside : []),
              ]
            : []),
      ]
    : [{ label: tr(designName), go: () => dsel().select(null) }, ...inside];

  return (
    <main
      ref={workRef}
      className={`work mode-${mode} ${sheetOpen ? 'sheet-open' : ''} ${sheetStop === 'full' ? 'sheet-full' : ''}${canvas ? ' canvas' : ''}${outLensOn ? ' out-lens' : ''}`}
      hidden={!active}
    >
      <aside className="side" aria-label={t('Compose')} ref={sideRef}>
        {canvas && (
          <LensHead
            keys={lensKeyList}
            inProject={inProject}
            tall={sheetStop === 'full'}
            onJump={(k) => {
              const body = sideBodyRef.current;
              if (body) scrollToBlock(body, k);
            }}
            onTall={(tall) => setSheetStop(tall ? 'full' : 'half')}
            onClose={() => setSheetStop('peek')}
          />
        )}
        <div className="sheet-peek-row" hidden={canvas}>
          {phone && <SheetHandle stop={sheetStop} onStop={setSheetStop} />}
          <button
            type="button"
            className="sheet-peek"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(!sheetOpen)}
          >
            {/* One line; a long piece name ends in an ellipsis and shows in full on hover (ADR-114). */}
            <span title={peek}>{peek}</span>
            <Icon name={sheetOpen ? 'chevron-down' : 'chevron-up'} className="sm" />
          </button>
          {phone && inProject && <PeekActions onAdd={openPieces} />}
        </div>
        {/* Phones: Settings and Material open here, the sheet at full height (ADR-247). */}
        <div id="sheet-slot" className="sheet-slot" />
        <div className="side-body" ref={sideBodyRef}>
          {inProject ? (
            <PanelProject mode="compose" onAdd={openPieces} />
          ) : (
            <PanelInspector mode="compose" />
          )}
          {/* The panel ends with the results (ADR-295), each opening its output card (ADR-288). */}
          {canvas && (
            <Section title={t('Results')}>
              <div className="results-block">
                {outputs.map(([k, label]) => (
                  <button key={k} type="button" className="btn" onClick={() => openOutput(k)}>
                    {label}
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      </aside>
      <section
        ref={stageRef}
        // A tap on empty drawing closes the canvas editor's card (ADR-283); a tap on a part selects it.
        onClick={
          canvas && sheetOpen
            ? (e) => {
                const el = e.target as Element;
                if (el === e.currentTarget || el.tagName.toLowerCase() === 'svg')
                  setSheetStop('peek');
              }
            : undefined
        }
        className={`stage ${shown === 'both' ? 'both' : ''} ${piecesShown ? 'with-pieces' : ''}`}
        aria-label={t('Drawing')}
      >
        {canvas && mode === 'compose' && <LadderPill crumbs={crumbs} />}
        {piecesShown && (
          <PieceList
            onBrowse={() => {
              setPiecesOpen(false);
              onCatalog();
            }}
            onWizard={onWizardToProject}
          />
        )}
        <StageTools
          shown={shown}
          setView={setView}
          has3d={has3d}
          frontsInPlan={frontsInPlan}
          compact={phone || short}
          mount3d={mount3d}
          onRender={onRender}
        />
        <div className={`views ${shown === 'both' ? 'both' : ''}`}>
          <div className={`view front ${showsDrawing(shown) ? 'active' : ''}`}>
            {inProject ? (
              <DrawingPlan fronts={frontsInPlan} card={!(phone && shows3d(shown))} />
            ) : (
              <DrawingFront />
            )}
          </div>
          <div
            className={`view three ${shows3d(shown) ? 'active' : ''}`}
            role="region"
            aria-label={t('3D view')}
            data-seams={seams ?? undefined}
            data-lit={lit ?? undefined}
          >
            <ViewerSlot mount={mount3d} has3d={has3d} countDock={countDock} />
          </div>
        </div>
        {/* The canvas editor: the quick-count card docks under the 3D view, inside the stage (ADR-295). */}
        {canvasStage && <div id="count-dock" ref={setCountDock} className="count-dock-slot" />}
        {/* The edit bar (ADR-295): Find, Edit, the Checks chip and the project's actions, in a fixed order. */}
        {canvasStage && (
          <EditBar
            selection={crumbs[crumbs.length - 1]?.label ?? ''}
            open={sheetOpen}
            onEdit={() => {
              setOutOpen(false);
              setSheetStop(sheetOpen ? 'peek' : 'half');
            }}
            onFind={() => setFindOpen(true)}
          >
            {/* Checks chip (ADR-287): the error count, one tap to the Checks list. */}
            {checkErrors > 0 && (
              <button
                type="button"
                className="btn chip problem"
                onClick={() => {
                  setMode('build');
                  useDesign.getState().setTab('checks');
                }}
              >
                {t('Checks: {n|# problem|# problems}', { n: checkErrors })}
              </button>
            )}
            {inProject && <PeekActions onAdd={openPieces} />}
          </EditBar>
        )}
      </section>
      {/* Phones: the 3D view's quick-count card docks here, under the stage, which keeps its height (G-070). */}
      {phone && !canvasStage && (
        <div id="count-dock" ref={setCountDock} className="count-dock-slot" />
      )}
      {/* Phones: the running estimate heads the Cut list place (ADR-241; was in the mode row). */}
      {phone && (
        <div className="cut-estimate">
          <EstimateChip compact />
        </div>
      )}
      <Results />
      {canvas && (
        <>
          <FindAction
            open={findOpen}
            blocks={lensKeyList}
            outputs={outputs}
            onBlock={pickLens}
            onOutput={(tab) => openOutput(tab as Tab)}
            onClose={() => setFindOpen(false)}
          />
          <CanvasHints on={active && mode === 'compose'} />
        </>
      )}
      {outLensOn && (
        <button
          type="button"
          className="btn icon lens-out-close"
          aria-label={t('Close the card')}
          onClick={() => setOutOpen(false)}
        >
          <Icon name="x" />
        </button>
      )}
    </main>
  );
}
