/**
 * The gaps ledger (ADR-082) read for the Gaps page (ADR-101). Parses `docs/adr/GAPS.md` the same way
 * `scripts/gaps.py` does: a `### Name` heading, then `- Key: value` lines, keyed by `- Id: <uuid>` and cited by
 * `- Number: G-NNN HH:MM` (ADR-151). Malformed sections are skipped; nothing here throws.
 */

export type GapStatusKind = 'open' | 'acknowledged' | 'adr' | 'done';

export interface Gap {
  /** The UUID from `- Id:` (ADR-151). */
  id: string;
  /** "G-NNN", the number ADRs and replies cite; not unique across branches. */
  number: string;
  /** "G-NNN HH:MM Name". */
  title: string;
  /** The Status line as written, e.g. "Open", "ADR-101", "Done (ADR-087)". */
  status: string;
  kind: GapStatusKind;
  origin: string;
  missing: string;
  request: string;
  questions: string;
  pick: string;
  notes: string[];
}

/** What the user decided on this device for one gap (ADR-101). Never written automatically. */
export interface GapMark {
  gapId: string;
  decision: 'acknowledge' | 'adr' | null;
  note: string;
  updatedAt: string;
}

export const STATUS_KINDS: GapStatusKind[] = ['open', 'acknowledged', 'adr', 'done'];
export const STATUS_LABEL: Record<GapStatusKind, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  adr: 'Moved to an ADR',
  done: 'Done',
};

const HEAD = /^### (.+)$/gm;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NUMBER = /^(G-\d{3}) \d{2}:\d{2}$/;
const FIELD = /^- ([A-Z][a-z]+(?: [a-z]+)?): (.*)$/gm;

export function statusKind(status: string): GapStatusKind | null {
  if (status === 'Open') return 'open';
  if (/^Acknowledged \(\d{4}-\d{2}-\d{2}\)$/.test(status)) return 'acknowledged';
  if (/^ADR-\d{3}$/.test(status)) return 'adr';
  if (/^Done \(.+\)$/.test(status)) return 'done';
  return null;
}

export function parseGaps(text: string): Gap[] {
  const heads = [...text.matchAll(HEAD)];
  const gaps: Gap[] = [];
  heads.forEach((h, i) => {
    const start = (h.index ?? 0) + h[0].length;
    const end = i + 1 < heads.length ? (heads[i + 1].index ?? text.length) : text.length;
    const fields: Record<string, string> = {};
    const notes: string[] = [];
    for (const f of text.slice(start, end).matchAll(FIELD)) {
      if (f[1] === 'Note') notes.push(f[2].trim());
      else fields[f[1]] = f[2].trim();
    }
    const status = fields['Status'] ?? '';
    const kind = statusKind(status);
    const id = fields['Id'] ?? '';
    const number = NUMBER.exec(fields['Number'] ?? '');
    if (!kind || !UUID.test(id) || !number) return;
    gaps.push({
      id,
      number: number[1],
      title: `${number[0]} ${h[1].trim()}`,
      status,
      kind,
      origin: fields['Origin'] ?? '',
      missing: fields['Missing'] ?? '',
      request: fields['Request'] ?? '',
      questions: fields['Questions'] ?? '',
      pick: fields['Suggested pick'] ?? '',
      notes,
    });
  });
  return gaps;
}

export function gapCounts(gaps: Gap[]): Record<GapStatusKind, number> {
  const out: Record<GapStatusKind, number> = { open: 0, acknowledged: 0, adr: 0, done: 0 };
  for (const g of gaps) out[g.kind] += 1;
  return out;
}

export function filterGaps(gaps: Gap[], query: string, kinds: GapStatusKind[]): Gap[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return gaps.filter((g) => {
    if (!kinds.includes(g.kind)) return false;
    const hay = [
      g.id,
      g.title,
      g.status,
      g.origin,
      g.missing,
      g.request,
      g.questions,
      g.pick,
      ...g.notes,
    ]
      .join(' ')
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/**
 * The key a gap's mark is stored under: its UUID, or the G-NNN of a mark saved before ADR-151, read as it is.
 */
export const markKey = (g: Gap, marks: Record<string, GapMark>): string =>
  !marks[g.id] && marks[g.number] ? g.number : g.id;

/** A mark says something only when it has a decision or a note. */
export const isMarked = (m: GapMark | undefined): m is GapMark =>
  !!m && (m.decision !== null || m.note.trim() !== '');

/**
 * The text the user pastes to Claude: one line per marked gap that the shipped ledger still has Open or moved to an
 * ADR. Empty when nothing is marked.
 */
export function decisionsText(gaps: Gap[], marks: Record<string, GapMark>): string {
  const lines: string[] = [];
  for (const g of gaps) {
    const m = marks[markKey(g, marks)];
    if (!isMarked(m) || (g.kind !== 'open' && g.kind !== 'adr')) continue;
    // One line per gap, whatever the note's line breaks.
    const note = m.note.trim().replace(/\s*\n\s*/g, ' ');
    const what =
      m.decision === 'acknowledge'
        ? `acknowledge ${g.title}`
        : m.decision === 'adr'
          ? `make an ADR from ${g.title}`
          : `note on ${g.title}`;
    lines.push(`- ${what}${note ? `: ${note}` : ''}`);
  }
  return lines.length ? ['Gap decisions from the app (ADR-101):', ...lines].join('\n') : '';
}

export function validateGapMark(v: unknown): v is GapMark {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.gapId === 'string' &&
    (/^G-\d{3}$/.test(m.gapId) || UUID.test(m.gapId)) &&
    (m.decision === null || m.decision === 'acknowledge' || m.decision === 'adr') &&
    typeof m.note === 'string' &&
    typeof m.updatedAt === 'string'
  );
}
