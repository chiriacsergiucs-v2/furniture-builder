/**
 * The gaps ledger (ADR-082) read for the Gaps page (ADR-101). Parses `docs/adr/GAPS.md` the same way
 * `scripts/gaps.py` does: a `### G-NNN: title` heading, then `- Key: value` lines. Malformed sections are skipped;
 * nothing here throws. ADR-187 adds rough Work, Impact and Necessity ratings, an Issue and a Fix line and a Conflicts
 * line per gap; a gap without them still parses.
 */

import { CONFIDENCE_SCALE } from './research/types';

/** The rating scale of the gaps (ADR-187), the same five levels as the Research page. */
export const RATING_SCALE = CONFIDENCE_SCALE;
export type GapRating = (typeof RATING_SCALE)[number];
export type RatingKey = 'work' | 'impact' | 'necessity';
export const RATING_KEYS: RatingKey[] = ['work', 'impact', 'necessity'];
export const RATING_LABEL: Record<RatingKey, string> = {
  work: 'Work',
  impact: 'Impact',
  necessity: 'Necessity',
};
/** Selected levels per rating; an empty or missing list means every gap (ADR-187). */
export type RatingFilter = Partial<Record<RatingKey, GapRating[]>>;

const asRating = (v: string | undefined): GapRating | null =>
  (RATING_SCALE as readonly string[]).includes(v ?? '') ? (v as GapRating) : null;

export type GapStatusKind = 'open' | 'acknowledged' | 'adr' | 'done';

export interface Gap {
  id: string;
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
  /** Rough estimates (ADR-187); null when the ledger has none or a value off the scale. */
  work: GapRating | null;
  impact: GapRating | null;
  necessity: GapRating | null;
  /** One line: what is wrong or missing. Empty when the ledger has none. */
  issue: string;
  /** One line: what would close it. Empty when the ledger has none. */
  fix: string;
  /** `none`, or the implemented ADR(s) the fix would contradict and why; empty when the ledger has none. */
  conflicts: string;
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

const HEAD = /^### (G-\d{3}): (.+)$/gm;
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
    if (!kind) return;
    gaps.push({
      id: h[1],
      title: h[2].trim(),
      status,
      kind,
      origin: fields['Origin'] ?? '',
      missing: fields['Missing'] ?? '',
      request: fields['Request'] ?? '',
      questions: fields['Questions'] ?? '',
      pick: fields['Suggested pick'] ?? '',
      notes,
      work: asRating(fields['Work']),
      impact: asRating(fields['Impact']),
      necessity: asRating(fields['Necessity']),
      issue: fields['Issue'] ?? '',
      fix: fields['Fix'] ?? '',
      conflicts: fields['Conflicts'] ?? '',
    });
  });
  return gaps;
}

export function gapCounts(gaps: Gap[]): Record<GapStatusKind, number> {
  const out: Record<GapStatusKind, number> = { open: 0, acknowledged: 0, adr: 0, done: 0 };
  for (const g of gaps) out[g.kind] += 1;
  return out;
}

/** A Conflicts value other than `none` (ADR-187). */
export const hasConflict = (g: Gap): boolean =>
  g.conflicts !== '' && g.conflicts.toLowerCase() !== 'none';

/** How many of `gaps` have each level of each rating. */
export function ratingCounts(gaps: Gap[]): Record<RatingKey, Record<GapRating, number>> {
  const zero = () =>
    Object.fromEntries(RATING_SCALE.map((l) => [l, 0])) as Record<GapRating, number>;
  const out = { work: zero(), impact: zero(), necessity: zero() };
  for (const g of gaps)
    for (const k of RATING_KEYS) {
      const v = g[k];
      if (v) out[k][v] += 1;
    }
  return out;
}

/**
 * The gaps with one of `kinds`, every word of `query` and, per rating, one of the selected levels (an empty
 * selection lets every gap through, ADR-187).
 */
export function filterGaps(
  gaps: Gap[],
  query: string,
  kinds: GapStatusKind[],
  ratings: RatingFilter = {},
): Gap[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return gaps.filter((g) => {
    if (!kinds.includes(g.kind)) return false;
    for (const k of RATING_KEYS) {
      const want = ratings[k];
      const v = g[k];
      if (want?.length && !(v && want.includes(v))) return false;
    }
    const hay = [
      g.id,
      g.title,
      g.status,
      g.origin,
      g.missing,
      g.request,
      g.questions,
      g.pick,
      g.issue,
      g.fix,
      g.conflicts,
      ...g.notes,
    ]
      .join(' ')
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

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
    const m = marks[g.id];
    if (!isMarked(m) || (g.kind !== 'open' && g.kind !== 'adr')) continue;
    // One line per gap, whatever the note's line breaks.
    const note = m.note.trim().replace(/\s*\n\s*/g, ' ');
    const what =
      m.decision === 'acknowledge'
        ? `acknowledge ${g.id} (${g.title})`
        : m.decision === 'adr'
          ? `make an ADR from ${g.id} (${g.title})`
          : `note on ${g.id} (${g.title})`;
    lines.push(`- ${what}${note ? `: ${note}` : ''}`);
  }
  return lines.length ? ['Gap decisions from the app (ADR-101):', ...lines].join('\n') : '';
}

export function validateGapMark(v: unknown): v is GapMark {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.gapId === 'string' &&
    /^G-\d{3}$/.test(m.gapId) &&
    (m.decision === null || m.decision === 'acknowledge' || m.decision === 'adr') &&
    typeof m.note === 'string' &&
    typeof m.updatedAt === 'string'
  );
}

/** The kind tag of a gap-marks file (ADR-212, G-100). */
export const GAP_MARKS_KIND = 'furniture-builder-gap-marks';
export interface GapMarksFile {
  kind: typeof GAP_MARKS_KIND;
  version: 1;
  exportedAt: string;
  marks: GapMark[];
}

/** The marks as a file to move to another device (ADR-212): only valid marks are written. */
export function gapMarksFile(marks: readonly GapMark[], exportedAt: string): GapMarksFile {
  return {
    kind: GAP_MARKS_KIND,
    version: 1,
    exportedAt,
    marks: marks.filter(validateGapMark).map((m) => ({
      gapId: m.gapId,
      decision: m.decision,
      note: m.note,
      updatedAt: m.updatedAt,
    })),
  };
}

export interface GapMarksImport {
  /** Marks to write: newer than the one on this device, or for a gap with none. */
  apply: GapMark[];
  /** Valid rows for a gap in the ledger (applied or older than the device's mark). */
  imported: number;
  /** Rows that are invalid or name a gap not in the ledger. */
  skipped: number;
  /** Set when the file itself cannot be read; nothing is applied. */
  problem?: string;
}

/**
 * Reads a gap-marks file (ADR-212). Never throws: every row is checked with `validateGapMark` (ADR-011); rows that
 * are invalid or name a gap not in `known` are skipped and counted; per gap the newer `updatedAt` wins, against the
 * device's marks and against earlier rows of the same file.
 */
export function readGapMarksFile(
  text: string,
  known: ReadonlySet<string>,
  current: Readonly<Record<string, GapMark>>,
): GapMarksImport {
  const notAFile = {
    apply: [],
    imported: 0,
    skipped: 0,
    problem: 'The file is not a gap-marks file.',
  };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return notAFile;
  }
  if (!data || typeof data !== 'object') return notAFile;
  const f = data as Record<string, unknown>;
  if (f.kind !== GAP_MARKS_KIND || !Array.isArray(f.marks)) return notAFile;
  if (f.version !== 1)
    return {
      apply: [],
      imported: 0,
      skipped: 0,
      problem: 'The file is from another version of the app.',
    };
  const best = new Map<string, GapMark>();
  let imported = 0;
  let skipped = 0;
  for (const row of f.marks as unknown[]) {
    if (!validateGapMark(row) || !known.has(row.gapId)) {
      skipped++;
      continue;
    }
    imported++;
    const mark: GapMark = {
      gapId: row.gapId,
      decision: row.decision,
      note: row.note,
      updatedAt: row.updatedAt,
    };
    const prev = best.get(mark.gapId) ?? current[mark.gapId];
    if (!prev || mark.updatedAt > prev.updatedAt) best.set(mark.gapId, mark);
  }
  return { apply: [...best.values()], imported, skipped };
}
