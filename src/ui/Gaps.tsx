import { useEffect, useMemo, useState } from 'react';
import ledger from '../../docs/adr/GAPS.md?raw';
import {
  decisionsText,
  filterGaps,
  gapCounts,
  isMarked,
  parseGaps,
  STATUS_KINDS,
  STATUS_LABEL,
  type Gap,
  type GapMark,
  type GapStatusKind,
} from '../core/gaps';
import { listGapMarks, saveGapMark } from '../persist/db';
import { Icon } from './icons';

/** The ledger as it was when this app was built (ADR-101); the file in the repo stays the source of truth. */
const GAPS = parseGaps(ledger);

/**
 * The Gaps page (ADR-101): the gaps ledger (ADR-082) with counts, search, a status filter and every field of each
 * gap. The user marks gaps on this device (Acknowledge, Make ADR, a note) and copies the decisions to paste to
 * Claude, who applies them to `docs/adr/GAPS.md`. Nothing here changes the ledger itself (ADR-002).
 */
export function GapsPage({ onDone }: { onDone: () => void }) {
  const [marks, setMarks] = useState<Record<string, GapMark>>({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<GapStatusKind[]>(['open']);
  const [copied, setCopied] = useState<string | null>(null);
  // Rows mount again once the marks are read, so each note box starts from its stored note.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listGapMarks()
      .then((rows) => setMarks(Object.fromEntries(rows.map((m) => [m.gapId, m]))))
      .catch(() => setError('Your marks could not be read on this device.'))
      .finally(() => setLoaded(true));
  }, []);

  const counts = useMemo(() => gapCounts(GAPS), []);
  const shown = useMemo(() => filterGaps(GAPS, query, kinds), [query, kinds]);
  const markedCount = GAPS.filter((g) => isMarked(marks[g.id])).length;

  const save = (gapId: string, patch: Partial<Pick<GapMark, 'decision' | 'note'>>) => {
    const old = marks[gapId] ?? { gapId, decision: null, note: '', updatedAt: '' };
    const mark: GapMark = { ...old, ...patch, updatedAt: new Date().toISOString() };
    setMarks((m) => ({ ...m, [gapId]: mark }));
    saveGapMark(mark).catch(() => setError('Your mark could not be saved on this device.'));
  };
  const toggleKind = (k: GapStatusKind) =>
    setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  const copy = () => {
    const text = decisionsText(GAPS, marks);
    setCopied(text);
    if (text) navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  return (
    <main className="catalog-page gaps-page" aria-label="Gaps">
      <header className="catalog-head">
        <div>
          <h1>Gaps</h1>
          <p className="hint">
            <strong className="num">{GAPS.length} gaps</strong> in the ledger built into this
            version of the app: things asked for or implied that were not built. Marks stay on this
            device; Copy decisions gives the text to paste to Claude, who updates the ledger.
          </p>
        </div>
        <button type="button" className="btn outline" onClick={onDone}>
          <Icon name="chevron-right" className="sm" />
          Back to the editor
        </button>
      </header>
      {error && (
        <p className="alert warning" role="status">
          <Icon name="alert-triangle" className="sm" />
          <span>{error}</span>
        </p>
      )}
      <section className="tiles" aria-label="Totals">
        {STATUS_KINDS.map((k) => (
          <div key={k} className="tile">
            <strong className="num">{counts[k]}</strong>
            <span>{STATUS_LABEL[k]}</span>
          </div>
        ))}
        <div className="tile">
          <strong className="num">{markedCount}</strong>
          <span>Marked by you</span>
        </div>
      </section>
      <div className="catalog-toolbar gaps-toolbar">
        <label className="search">
          <Icon name="search" className="sm" />
          <input
            type="search"
            placeholder="Search, e.g. G-012, drawer, ADR-072"
            aria-label="Search the gaps"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="chips" role="group" aria-label="Status">
          {STATUS_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={`chip filter ${kinds.includes(k) ? 'on' : ''}`}
              aria-pressed={kinds.includes(k)}
              onClick={() => toggleKind(k)}
            >
              {STATUS_LABEL[k]} ({counts[k]})
            </button>
          ))}
        </div>
        <div className="gaps-copy">
          <button type="button" className="btn primary" onClick={copy}>
            <Icon name="copy" className="sm" />
            Copy decisions (
            {
              GAPS.filter((g) => isMarked(marks[g.id]) && (g.kind === 'open' || g.kind === 'adr'))
                .length
            }
            )
          </button>
        </div>
      </div>
      {copied !== null && (
        <section className="gaps-decisions" aria-label="Decisions to paste to Claude">
          <h2>Decisions to paste to Claude</h2>
          {copied ? (
            <textarea readOnly rows={Math.min(12, copied.split('\n').length + 1)} value={copied} />
          ) : (
            <p className="hint">Nothing marked yet: Acknowledge, Make ADR or a note on a gap.</p>
          )}
        </section>
      )}
      <p className="hint" role="status">
        {shown.length} of {GAPS.length} shown
      </p>
      <ul className="gaps-list">
        {shown.map((g) => (
          <GapRow
            key={`${g.id}:${loaded}`}
            gap={g}
            mark={marks[g.id]}
            onSave={(p) => save(g.id, p)}
          />
        ))}
      </ul>
    </main>
  );
}

function GapRow({
  gap: g,
  mark,
  onSave,
}: {
  gap: Gap;
  mark: GapMark | undefined;
  onSave: (patch: Partial<Pick<GapMark, 'decision' | 'note'>>) => void;
}) {
  const [note, setNote] = useState(mark?.note ?? '');
  const decide = (d: 'acknowledge' | 'adr') =>
    onSave({ decision: mark?.decision === d ? null : d });
  const actionable = g.kind === 'open' || g.kind === 'adr';
  return (
    <li className="family gap">
      <details>
        <summary>
          <strong>{g.id}</strong> {g.title}{' '}
          <span className={`chip ${g.kind === 'open' ? '' : 'subtle'}`}>{g.status}</span>
          {mark?.decision === 'acknowledge' && (
            <span className="chip edited">You: acknowledge</span>
          )}
          {mark?.decision === 'adr' && <span className="chip edited">You: make ADR</span>}
        </summary>
        <dl className="pairs">
          <dt>Status</dt>
          <dd>{g.status}</dd>
          <dt>Origin</dt>
          <dd>{g.origin}</dd>
          <dt>Missing</dt>
          <dd>{g.missing}</dd>
          <dt>Request</dt>
          <dd>{g.request}</dd>
          <dt>Questions</dt>
          <dd>{g.questions}</dd>
          <dt>Suggested pick</dt>
          <dd>{g.pick}</dd>
          {g.notes.map((n, i) => (
            <FragmentNote key={i} note={n} />
          ))}
        </dl>
        {actionable && (
          <div className="gap-actions">
            <button
              type="button"
              className={`btn outline ${mark?.decision === 'acknowledge' ? 'on' : ''}`}
              aria-pressed={mark?.decision === 'acknowledge'}
              onClick={() => decide('acknowledge')}
            >
              Acknowledge
            </button>
            <button
              type="button"
              className={`btn outline ${mark?.decision === 'adr' ? 'on' : ''}`}
              aria-pressed={mark?.decision === 'adr'}
              onClick={() => decide('adr')}
            >
              Make ADR
            </button>
            <label className="gap-note">
              Your note
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== (mark?.note ?? '') && onSave({ note })}
              />
            </label>
          </div>
        )}
      </details>
    </li>
  );
}

function FragmentNote({ note }: { note: string }) {
  return (
    <>
      <dt>Note</dt>
      <dd>{note}</dd>
    </>
  );
}
