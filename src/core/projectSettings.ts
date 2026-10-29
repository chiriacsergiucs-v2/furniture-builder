/**
 * Project-wide settings (ADR-124): carcass, front and back boards (with their banding), handle, front overlay and
 * plinth height. A piece follows a setting while its own value equals the project's; changing the setting changes
 * every following piece and no other. Pieces stay full copies (ADR-022): following is read from their values, so a
 * piece edited on its own simply stops following, and "Follow project" puts the project's value back.
 */
import { t } from './i18n';
import { newId } from './design';
import { roleBoard } from './finish';
import { materialKey, type Project, type ProjectItem, type ProjectSettings } from './project';
import type { Design, FrontStyle, Handle, Material, Mm } from './types';

export type SettingKey = keyof ProjectSettings;
export const SETTING_KEYS: SettingKey[] = [
  'body',
  'front',
  'back',
  'handle',
  'frontStyle',
  'plinthHeight',
];
export const SETTING_LABEL: Record<SettingKey, string> = {
  body: t('Carcass board'),
  front: t('Front board'),
  back: t('Back board'),
  handle: t('Handle'),
  frontStyle: t('Front overlay'),
  plinthHeight: t('Plinth height'),
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** A board as one value: name, thickness, grain, picture and banding (its id does not count). */
const boardKey = (m: Material) =>
  `${materialKey(m)}|${JSON.stringify(m.band ?? null)}|${JSON.stringify(m.frontBand ?? null)}`;

function backBoard(d: Design): string | null {
  const p = d.product;
  return p.kind === 'cabinet' || p.kind === 'corner' ? p.params.backMaterialId : null;
}

/** Every space (or panel) that carries a handle setting, in the design's params. */
function handleHolders(v: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(v)) v.forEach((x) => handleHolders(x, out));
  else if (isObj(v)) {
    // A space with a front or drawers takes a handle (absent = none), and so does a panel that has the setting.
    const space = typeof v.kind === 'string' && typeof v.id === 'string';
    if ('handle' in v || (space && (isObj(v.front) || v.kind === 'drawers'))) out.push(v);
    for (const [k, x] of Object.entries(v)) if (k !== 'handle') handleHolders(x, out);
  }
  return out;
}

/** The piece's value for a setting, or undefined when it has no such part (a bed has no fronts). */
export function settingOf(d: Design, key: SettingKey): unknown {
  const p = d.product;
  const boardOf = (id: string | null) => {
    const m = id ? d.materials.find((x) => x.id === id) : undefined;
    return m ? boardKey(m) : undefined;
  };
  switch (key) {
    case 'body':
    case 'front':
      return boardOf(roleBoard(d, key));
    case 'back':
      return boardOf(backBoard(d));
    case 'handle': {
      const h = handleHolders(p.params);
      return h.length ? JSON.stringify(h[0].handle ?? null) : undefined;
    }
    case 'frontStyle':
      return p.kind === 'cabinet' ? (p.params.frontStyle ?? 'overlay') : undefined;
    case 'plinthHeight':
      return (p.kind === 'cabinet' && p.params.mount !== 'wall') || p.kind === 'corner'
        ? p.params.plinthHeight
        : undefined;
  }
}

/** The project's value of a setting, in the same form as `settingOf`; undefined when not set. */
export function projectValue(s: ProjectSettings | undefined, key: SettingKey): unknown {
  const v = s?.[key];
  if (v === undefined) return undefined;
  if (key === 'body' || key === 'front' || key === 'back') return boardKey(v as Material);
  if (key === 'handle') return JSON.stringify(v ?? null);
  return v;
}

/** The design with the project's value of `key`; unchanged when it has no such part or the value is not set. */
export function withSetting(d: Design, key: SettingKey, s: ProjectSettings): Design {
  const v = s[key];
  if (v === undefined || settingOf(d, key) === undefined) return d;
  const p = d.product;
  if (key === 'body' || key === 'front' || key === 'back') {
    // The board with its banding: the design's own copy when it has the very same, else a new copy.
    const board = v as Material;
    const have = d.materials.find((m) => boardKey(m) === boardKey(board));
    const mat = have ?? { ...board, id: newId() };
    const materials = have ? d.materials : [...d.materials, mat];
    const field =
      p.kind === 'panel' ? 'materialId' : `${key === 'front' ? 'front' : key}MaterialId`;
    const params = { ...p.params, [field]: mat.id };
    return { ...d, materials, product: { ...p, params } as Design['product'] };
  }
  if (key === 'handle') {
    const params = structuredClone(p.params);
    for (const h of handleHolders(params)) h.handle = structuredClone(v as Handle | null);
    return { ...d, product: { ...p, params } as Design['product'] };
  }
  if (key === 'frontStyle' && p.kind === 'cabinet')
    return { ...d, product: { ...p, params: { ...p.params, frontStyle: v as FrontStyle } } };
  if (key === 'plinthHeight' && (p.kind === 'cabinet' || p.kind === 'corner'))
    return {
      ...d,
      product: { ...p, params: { ...p.params, plinthHeight: v as Mm } },
    } as Design;
  return d;
}

/** The design with every project setting it has a part for: a piece added to the project follows them. */
export function withSettings(d: Design, s: ProjectSettings | undefined): Design {
  if (!s) return d;
  return SETTING_KEYS.reduce((x, k) => withSetting(x, k, s), d);
}

export type Follows = 'follows' | 'own' | 'n/a';

/** Whether the piece follows the project's setting: n/a when the project has none or the piece has no such part. */
export function follows(project: Project, item: ProjectItem, key: SettingKey): Follows {
  const pv = projectValue(project.settings, key);
  const own = settingOf(item.design, key);
  if (pv === undefined || own === undefined) return 'n/a';
  return own === pv ? 'follows' : 'own';
}

/** "Oak 18 mm", "Bar handle", "Inset", "100 mm" — a setting's value for people. */
export function settingText(d: Design | null, key: SettingKey, s?: ProjectSettings): string {
  const v = s ? s[key] : undefined;
  if (key === 'body' || key === 'front' || key === 'back') {
    const m = s
      ? (v as Material | undefined)
      : d?.materials.find(
          (x) =>
            x.id ===
            (key === 'back' ? backBoard(d) : roleBoard(d, key === 'front' ? 'front' : 'body')),
        );
    return m ? t('{name} {t} mm', { name: m.name, t: m.thickness }) : '—';
  }
  if (key === 'handle') {
    const h = s
      ? (v as Handle | null | undefined)
      : (() => {
          const hs = d ? handleHolders(d.product.params) : [];
          return hs.length ? (hs[0].handle as Handle | null | undefined) : undefined;
        })();
    if (h === undefined) return '—';
    return h === null
      ? t('No handle')
      : h.kind === 'push'
        ? t('Push-to-open handle')
        : h.kind === 'bar'
          ? t('Bar handle')
          : t('Knob handle');
  }
  if (key === 'frontStyle') {
    const f = (s ? v : d && settingOf(d, key)) as FrontStyle | undefined;
    return f ? { overlay: t('Overlay'), half: t('Half overlay'), inset: t('Inset') }[f] : '—';
  }
  const mm = s ? v : d && settingOf(d, key);
  return mm === undefined || mm === null ? '—' : t('{v} mm', { v: String(mm) });
}

export interface SettingResult {
  project: Project;
  /** Names of the pieces that took the new value. */
  applied: string[];
}

/**
 * Set (or clear, with undefined) a project setting: every piece that followed the old value (all pieces with such a
 * part when it was not set) takes the new one; pieces with their own value keep it. Clearing changes no piece.
 */
export function setProjectSetting(
  project: Project,
  key: SettingKey,
  value: ProjectSettings[SettingKey] | undefined,
): SettingResult {
  const settings: ProjectSettings = { ...project.settings };
  const old = projectValue(project.settings, key);
  if (value === undefined) delete settings[key];
  else (settings as Record<string, unknown>)[key] = value;
  const applied: string[] = [];
  const items =
    value === undefined
      ? project.items
      : project.items.map((it) => {
          const own = settingOf(it.design, key);
          if (own === undefined || (old !== undefined && own !== old)) return it;
          const design = withSetting(it.design, key, settings);
          if (design === it.design) return it;
          applied.push(it.design.name);
          return { ...it, design };
        });
  const next = { ...project, items };
  if (Object.keys(settings).length) next.settings = settings;
  else delete next.settings;
  return { project: next, applied };
}

/** The piece takes the project's value again ("Follow project"). */
export function followProject(project: Project, itemId: string, key: SettingKey): Project {
  if (!project.settings) return project;
  const s = project.settings;
  return {
    ...project,
    items: project.items.map((it) =>
      it.id === itemId ? { ...it, design: withSetting(it.design, key, s) } : it,
    ),
  };
}
