/**
 * Templates edited on this device (ADR-034). Shipped families are read-only; an edit is stored as a local template
 * that shadows the shipped one (`shadows`), or a new family made from a saved design. Variant designs are stored as
 * data, so a local template is self-contained and survives app updates; nothing is replaced without the user's say.
 */
import { newId, validateDesign } from '../design';
import { t as tx } from '../i18n';
import type { CatalogMeta, Design } from '../types';
import {
  BUILT_CAPABILITIES,
  FUNCTIONS,
  ROOMS,
  type CatalogFamily,
  type CatalogVariant,
  type Capability,
} from './types';

export interface LocalVariant extends Omit<CatalogVariant, 'create'> {
  design?: Design;
}
export interface LocalFamily extends Omit<CatalogFamily, 'variants'> {
  variants: LocalVariant[];
}
export interface LocalTemplate {
  id: string;
  /** The shipped family id this one replaces on this device. */
  shadows?: string;
  /** Shipped `catalogVersion` this copy was taken from, to tell the user when the shipped template changed. */
  basedOn?: number;
  /**
   * The newest shipped `catalogVersion` the user chose to keep their copy over ("Keep mine", ADR-195): it hides the
   * update notice up to that version without touching `basedOn`, so the template's revision stays as it was.
   * Optional; older readers ignore it.
   */
  seenShipped?: number;
  revision: number;
  updatedAt: string;
  family: LocalFamily;
}

/** A family as shown: shipped or local, with how it relates to the shipped catalog. */
export interface ViewFamily extends CatalogFamily {
  localId?: string;
  /** The local template shadows a shipped family that has since been updated. */
  shippedUpdated?: boolean;
  /** Local family with no shipped counterpart. */
  own?: boolean;
}

export function toLocal(f: CatalogFamily): LocalFamily {
  const { variants, ...rest } = f;
  return {
    ...structuredClone(rest),
    variants: variants.map(({ create, ...v }) => ({
      ...structuredClone(v),
      ...(create ? { design: create() } : {}),
    })),
  };
}

/**
 * A template's revision as edited on this device (ADR-096), on the same scale as the shipped `catalogVersion`: an edit
 * of shipped version N counts on from N (the copy starts at revision 1, each save adds one), so an edit is always newer
 * than the shipped version it was taken from. A family of the user's own counts its saves from 1.
 */
export const localRevision = (t: Pick<LocalTemplate, 'basedOn' | 'revision'>): number =>
  (t.basedOn ?? 1) + t.revision - 1;

export function fromLocal(t: LocalTemplate, shipped?: CatalogFamily): ViewFamily {
  const { variants, ...rest } = t.family;
  return {
    ...rest,
    localId: t.id,
    own: !t.shadows,
    shippedUpdated:
      !!shipped &&
      t.basedOn !== undefined &&
      shipped.catalogVersion > Math.max(t.basedOn, t.seenShipped ?? 0),
    // A copy taken from a template edited here records the template's revision (ADR-096), so a later edit of the
    // template shows as a newer revision on the pieces taken before it.
    catalogVersion: localRevision(t),
    variants: variants.map(({ design, ...v }) => ({
      ...v,
      ...(design ? { create: () => structuredClone(design) } : {}),
    })),
  };
}

/**
 * Shipped families with the local ones mixed in (ADR-034, user decision 2026-10-23): an edited family takes the
 * shipped one's place, the user's own new families follow, so grouping by room or type places them like any other.
 */
export function mergeCatalog(shipped: CatalogFamily[], locals: LocalTemplate[]): ViewFamily[] {
  const byShipped = new Map(locals.filter((t) => t.shadows).map((t) => [t.shadows!, t]));
  const own = locals.filter((t) => !t.shadows).map((t) => fromLocal(t));
  return [
    ...shipped.map((f) => {
      const t = byShipped.get(f.id);
      return t ? fromLocal(t, f) : f;
    }),
    ...own,
  ];
}

/** Start editing a shipped family: a local copy that shadows it. */
export const shadowOf = (f: CatalogFamily, now = new Date().toISOString()): LocalTemplate => ({
  id: newId(),
  shadows: f.id,
  basedOn: f.catalogVersion,
  revision: 1,
  updatedAt: now,
  family: toLocal(f),
});

/** "Save as template": a new family from a saved design. */
export function templateFromDesign(
  d: Design,
  meta: Pick<CatalogFamily, 'name' | 'function' | 'rooms'>,
  now = new Date().toISOString(),
): LocalTemplate {
  const root = d.product.kind;
  return {
    id: newId(),
    revision: 1,
    updatedAt: now,
    family: {
      id: `own-${newId()}`,
      name: meta.name,
      nameRo: meta.name,
      aliases: [],
      function: meta.function,
      rooms: meta.rooms,
      root,
      support: 'ready',
      structure: 'Saved from one of your designs.',
      configurations: ['Edit it like any design'],
      dims: { min: [1, 1, 1], max: [100_000, 100_000, 100_000] },
      catalogVersion: 1,
      variants: [
        {
          id: `own-${newId()}`,
          name: d.name,
          summary: 'Your design',
          kind: 'interior',
          requires: [],
          design: structuredClone({ ...d, catalog: undefined }),
        },
      ],
    },
  };
}

/**
 * The origin link of a piece saved to the catalog as template `t` (ADR-107): the template's first variant at its
 * current revision, so the piece reads "From <name>, revision 1" (ADR-096).
 */
export const templateOrigin = (
  t: LocalTemplate,
  now = new Date().toISOString(),
): NonNullable<CatalogMeta['origin']> => ({
  catalogId: t.family.id,
  variantId: t.family.variants[0]?.id,
  revision: localRevision(t),
  productName: t.family.name,
  takenAt: now,
});

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown, max = 500) => typeof v === 'string' && v.length > 0 && v.length <= max;
const CAPS = new Set<string>([
  ...BUILT_CAPABILITIES,
  'shape',
  'front:fixed',
  'front:lid',
  'frame:arms',
  'frame:modules',
  'frame:under-storage',
  'safety:user-confirmed',
] satisfies Capability[]);

/** What is wrong with a local template, as a code the UI turns into a sentence (ADR-195); `variant`: its name. */
export type TemplateProblemCode =
  | 'not-object'
  | 'no-id'
  | 'bad-shadows'
  | 'bad-seen'
  | 'no-family'
  | 'no-family-id'
  | 'no-name'
  | 'long-name'
  | 'bad-function'
  | 'no-rooms'
  | 'bad-rooms'
  | 'bad-aliases'
  | 'bad-configurations'
  | 'bad-structure'
  | 'variant-count'
  | 'variant-name'
  | 'bad-variant'
  | 'duplicate-variant'
  | 'variant-design';
export interface TemplateProblem {
  code: TemplateProblemCode;
  variant?: string;
}

/** Validate an untrusted local template (storage, file import). Never throws; an empty list means valid. */
export function validateLocalTemplate(t: unknown): TemplateProblem[] {
  if (!isObj(t)) return [{ code: 'not-object' }];
  const errs: TemplateProblem[] = [];
  const add = (code: TemplateProblemCode, variant?: string) =>
    errs.push(variant === undefined ? { code } : { code, variant });
  if (!isStr(t.id) || !Number.isSafeInteger(t.revision) || !isStr(t.updatedAt)) add('no-id');
  if (t.shadows !== undefined && !isStr(t.shadows)) add('bad-shadows');
  if (
    t.seenShipped !== undefined &&
    !(Number.isSafeInteger(t.seenShipped) && (t.seenShipped as number) >= 0)
  )
    add('bad-seen');
  const f = t.family;
  if (!isObj(f)) return [...errs, { code: 'no-family' }];
  if (!isStr(f.id)) add('no-family-id');
  if (typeof f.name !== 'string' || !f.name.trim()) add('no-name');
  else if (f.name.length > 200) add('long-name');
  if (!FUNCTIONS.includes(f.function as never)) add('bad-function');
  if (!Array.isArray(f.rooms) || !f.rooms.length) add('no-rooms');
  else if (!f.rooms.every((r) => ROOMS.includes(r as never))) add('bad-rooms');
  if (!Array.isArray(f.aliases) || !f.aliases.every((a) => isStr(a, 100))) add('bad-aliases');
  if (!Array.isArray(f.configurations) || !f.configurations.every((c) => isStr(c, 300)))
    add('bad-configurations');
  if (typeof f.structure !== 'string' || f.structure.length > 1000) add('bad-structure');
  if (!Array.isArray(f.variants) || f.variants.length < 1 || f.variants.length > 5)
    return [...errs, { code: 'variant-count' }];
  const ids = new Set<string>();
  for (const v of f.variants) {
    if (isObj(v) && typeof v.name === 'string' && (!v.name.trim() || v.name.length > 200)) {
      add('variant-name');
      continue;
    }
    if (
      !isObj(v) ||
      !isStr(v.id) ||
      !isStr(v.name, 200) ||
      typeof v.summary !== 'string' ||
      (v.kind !== 'interior' && v.kind !== 'construction') ||
      !Array.isArray(v.requires) ||
      !v.requires.every((c) => CAPS.has(c as string))
    ) {
      add('bad-variant');
      continue;
    }
    if (ids.has(v.id as string)) add('duplicate-variant', v.name as string);
    ids.add(v.id as string);
    if (v.design !== undefined && validateDesign(v.design).length)
      add('variant-design', v.name as string);
  }
  return errs;
}

/** The sentence the user reads for a template problem (ADR-195), in the app's language. */
export function templateProblemText(p: TemplateProblem): string {
  const name = p.variant ?? '';
  switch (p.code) {
    case 'not-object':
      return tx('This is not a template.');
    case 'no-id':
      return tx('The template is missing its id, revision or date.');
    case 'bad-shadows':
      return tx('The shipped template this one replaces could not be read.');
    case 'bad-seen':
      return tx('The shipped revision you kept your copy over could not be read.');
    case 'no-family':
      return tx('The template has no family.');
    case 'no-family-id':
      return tx('The template family has no id.');
    case 'no-name':
      return tx('Give the template a name.');
    case 'long-name':
      return tx('Shorten the name to 200 characters or fewer.');
    case 'bad-function':
      return tx('Pick a type.');
    case 'no-rooms':
      return tx('Tick at least one room.');
    case 'bad-rooms':
      return tx('A room in the template is not one the app knows.');
    case 'bad-aliases':
      return tx('Keep each other name to 1–100 characters.');
    case 'bad-configurations':
      return tx('Keep each line of what can be changed to 1–300 characters.');
    case 'bad-structure':
      return tx('Shorten the default structure to 1000 characters or fewer.');
    case 'variant-count':
      return tx('A template has 1 to 5 variants.');
    case 'variant-name':
      return tx('Give every variant a name of up to 200 characters.');
    case 'bad-variant':
      return tx('A variant could not be read.');
    case 'duplicate-variant':
      return tx('Two variants share one id (“{name}”).', { name });
    case 'variant-design':
      return tx('The design of variant “{name}” could not be read.', { name });
  }
}

/** Each distinct sentence for a list of problems, in order. */
export const templateProblemTexts = (ps: TemplateProblem[]): string[] => [
  ...new Set(ps.map(templateProblemText)),
];
