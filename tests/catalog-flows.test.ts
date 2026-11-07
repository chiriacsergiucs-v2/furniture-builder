import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogFamilies, findFamily, insertVariant } from '../src/core/catalog';
import {
  localRevision,
  mergeCatalog,
  shadowOf,
  templateFromDesign,
  templateProblemText,
  templateProblemTexts,
  validateLocalTemplate,
  type TemplateProblemCode,
} from '../src/core/catalog/local';
import { templates } from '../src/core/design';
import { loadDictionary, setLang } from '../src/core/i18n';
import * as db from '../src/persist/db';
import { useDesign } from '../src/store/designStore';
import { saveDesignToCatalog } from '../src/store/saveToCatalog';
import {
  cancelTemplateEdit,
  saveRevision,
  saveTemplateEdit,
  useTemplates,
} from '../src/store/templatesStore';

// The Russian dictionary is a lazy chunk (ADR-229): loaded before the cases that switch to Russian.
beforeAll(() => loadDictionary('ru'));

// ADR-195: honest template revisions, visible storage errors and user wording for template problems.

const clearStore = async () => {
  for (const t of await db.listTemplates()) await db.deleteTemplate(t.id);
  useTemplates.setState({ locals: [], loaded: true, error: null, draft: null });
};
const heightOf = (d: ReturnType<(typeof templates)[0]['create']> | undefined) =>
  d?.product.kind === 'cabinet' ? d.product.params.height : undefined;

beforeEach(clearStore);
afterEach(() => {
  vi.restoreAllMocks();
  setLang('en');
});

describe('Edit design in template mode records one revision per save (ADR-195, item 1)', () => {
  it('Edit design → Cancel stores nothing and hands the unsaved draft back to the Catalog', async () => {
    const draft = shadowOf(findFamily('bookcase')!);
    draft.family.name = 'My bookcase (unsaved)';
    useDesign.getState().editTemplateVariant(draft, draft.family.variants[0].id);
    useDesign.getState().updateCabinet({ height: 1500 });
    cancelTemplateEdit();
    expect(useDesign.getState().templateEdit).toBeNull();
    expect(await db.listTemplates()).toEqual([]);
    expect(useTemplates.getState().draft?.family.name).toBe('My bookcase (unsaved)');
    expect(useTemplates.getState().draft?.revision).toBe(draft.revision);
  });

  it('Edit design → Save to template stores the draft once, as one revision with the edited design', async () => {
    const draft = shadowOf(findFamily('bookcase')!);
    draft.family.name = 'Edited name';
    useDesign.getState().editTemplateVariant(draft, draft.family.variants[0].id);
    useDesign.getState().updateCabinet({ height: 1500 });
    expect(await saveTemplateEdit()).toBe(true);
    const rows = await db.listTemplates();
    expect(rows).toHaveLength(1);
    expect(rows[0].revision).toBe(draft.revision + 1);
    expect(rows[0].family.name).toBe('Edited name');
    expect(heightOf(rows[0].family.variants[0].design)).toBe(1500);
    expect(useTemplates.getState().draft).toBeNull();
  });

  it('the editor Save stores a draft as exactly one revision', async () => {
    const draft = shadowOf(findFamily('chest')!);
    const saved = (await saveRevision(draft))!;
    expect(saved.revision).toBe(draft.revision + 1);
    expect((await db.listTemplates()).map((t) => t.revision)).toEqual([draft.revision + 1]);
  });

  it('"Keep mine" writes seenShipped: the notice goes, basedOn and localRevision stay', () => {
    const shipped = findFamily('sideboard')!;
    const old = { ...shadowOf(shipped), basedOn: 0, revision: 3 };
    expect(
      mergeCatalog(catalogFamilies, [old]).find((f) => f.localId === old.id)?.shippedUpdated,
    ).toBe(true);
    const kept = { ...old, seenShipped: shipped.catalogVersion };
    const view = mergeCatalog(catalogFamilies, [kept]).find((f) => f.localId === kept.id)!;
    expect(view.shippedUpdated).toBe(false);
    expect(localRevision(kept)).toBe(localRevision(old));
    expect(view.catalogVersion).toBe(localRevision(old));
    expect(validateLocalTemplate(kept)).toEqual([]);
  });

  it('seenShipped is optional and validated on load: old rows still read, a bad value is reported', () => {
    const t = shadowOf(findFamily('chest')!);
    expect('seenShipped' in t).toBe(false);
    expect(validateLocalTemplate(t)).toEqual([]);
    expect(validateLocalTemplate({ ...t, seenShipped: 'two' })).toEqual([{ code: 'bad-seen' }]);
    expect(validateLocalTemplate({ ...t, seenShipped: 1.5 })).toEqual([{ code: 'bad-seen' }]);
  });
});

describe('storage failures are reported, never silent (ADR-195, item 2)', () => {
  it('a refused write returns false and sets the store error; nothing is added', async () => {
    vi.spyOn(db.db.templates, 'put').mockRejectedValue(new Error('QuotaExceededError'));
    const ok = await useTemplates.getState().save(shadowOf(findFamily('chest')!));
    expect(ok).toBe(false);
    expect(useTemplates.getState().error).toBe(
      'The template could not be saved in this browser’s storage.',
    );
    expect(useTemplates.getState().locals).toEqual([]);
  });

  it('a refused delete returns false, sets the error and keeps the template', async () => {
    const t = shadowOf(findFamily('chest')!);
    await useTemplates.getState().save(t);
    vi.spyOn(db.db.templates, 'delete').mockRejectedValue(new Error('blocked'));
    expect(await useTemplates.getState().remove(t.id)).toBe(false);
    expect(useTemplates.getState().error).toBe(
      'The template could not be removed from this browser’s storage.',
    );
    expect(useTemplates.getState().locals.map((x) => x.id)).toEqual([t.id]);
  });

  it('a failed read says the templates could not be read', async () => {
    vi.spyOn(db.db.templates, 'orderBy').mockImplementation(() => {
      throw new Error('broken');
    });
    await useTemplates.getState().refresh();
    expect(useTemplates.getState().error).toBe('Templates saved on this device could not be read.');
  });

  it('a template-mode Save that cannot be stored keeps the draft, edited design included, for the Catalog', async () => {
    const draft = shadowOf(findFamily('bookcase')!);
    useDesign.getState().editTemplateVariant(draft, draft.family.variants[0].id);
    useDesign.getState().updateCabinet({ height: 1400 });
    vi.spyOn(db.db.templates, 'put').mockRejectedValue(new Error('QuotaExceededError'));
    expect(await saveTemplateEdit()).toBe(false);
    const kept = useTemplates.getState().draft!;
    expect(kept.revision).toBe(draft.revision);
    expect(heightOf(kept.family.variants[0].design)).toBe(1400);
    expect(useTemplates.getState().error).toMatch(/could not be saved/);
  });

  it('Save to catalog from a design reports a refused write in the user’s words', async () => {
    vi.spyOn(db.db.templates, 'put').mockRejectedValue(new Error('QuotaExceededError'));
    const res = await saveDesignToCatalog(templates[0].create(), {
      name: 'Hall shelf',
      room: 'hallway',
      function: 'storage',
    });
    expect(res).toEqual({ error: 'The template could not be saved in this browser’s storage.' });
  });
});

describe('template problems are codes with user sentences, in English and Russian (ADR-195, item 6)', () => {
  const t = templateFromDesign(templates[1].create(), {
    name: 'Hall shelf',
    function: 'storage',
    rooms: ['hallway'],
  });
  const noRooms = { ...t, family: { ...t.family, rooms: [] } };
  const noName = { ...t, family: { ...t.family, name: '  ' } };

  it('no rooms and no name give codes, and the sentences the user reads', () => {
    expect(validateLocalTemplate(noRooms)).toEqual([{ code: 'no-rooms' }]);
    expect(validateLocalTemplate(noName)).toEqual([{ code: 'no-name' }]);
    expect(templateProblemTexts(validateLocalTemplate(noRooms))).toEqual([
      'Tick at least one room.',
    ]);
    expect(templateProblemTexts(validateLocalTemplate(noName))).toEqual([
      'Give the template a name.',
    ]);
    setLang('ru');
    expect(templateProblemTexts(validateLocalTemplate(noRooms))).toEqual([
      'Отметьте хотя бы одну комнату.',
    ]);
    expect(templateProblemTexts(validateLocalTemplate(noName))).toEqual([
      'Дайте шаблону название.',
    ]);
  });

  it('every code has an English sentence and a different Russian one; no developer wording', () => {
    const codes: TemplateProblemCode[] = [
      'not-object',
      'no-id',
      'bad-shadows',
      'bad-seen',
      'no-family',
      'no-family-id',
      'no-name',
      'long-name',
      'bad-function',
      'no-rooms',
      'bad-rooms',
      'bad-aliases',
      'bad-configurations',
      'bad-structure',
      'variant-count',
      'variant-name',
      'bad-variant',
      'duplicate-variant',
      'variant-design',
    ];
    const en = codes.map((code) => templateProblemText({ code, variant: 'Shelf' }));
    setLang('ru');
    const ru = codes.map((code) => templateProblemText({ code, variant: 'Shelf' }));
    codes.forEach((c, i) => {
      expect(en[i], c).toMatch(/\.$/);
      expect(ru[i], c).not.toBe(en[i]);
    });
    for (const raw of [
      'Rooms must be known room names',
      'Family needs an id and a name',
      'Invalid variant',
    ])
      expect(en.join(' ')).not.toContain(raw);
  });

  it('a variant design that does not validate is reported by name, not by the design validator’s text', () => {
    const bad = {
      ...t,
      family: {
        ...t.family,
        variants: [{ ...t.family.variants[0], design: { nope: true } }],
      },
    };
    const problems = validateLocalTemplate(bad);
    expect(problems).toEqual([{ code: 'variant-design', variant: t.family.variants[0].name }]);
    expect(templateProblemText(problems[0])).toBe(
      `The design of variant “${t.family.variants[0].name}” could not be read.`,
    );
  });

  it('the shipped text of a template saved from a design has Russian entries', async () => {
    const { tr } = await import('../src/core/i18n');
    setLang('ru');
    expect(tr(t.family.structure)).not.toBe(t.family.structure);
    expect(tr(t.family.configurations[0])).not.toBe(t.family.configurations[0]);
    expect(tr(t.family.variants[0].summary)).not.toBe(t.family.variants[0].summary);
  });
});

describe('a design saved to the catalog from the Catalog page (ADR-195, item 5)', () => {
  it('takes the name, room and type from the form and is stored', async () => {
    const d = insertVariant(findFamily('chest')!, findFamily('chest')!.variants[0])!;
    const res = await saveDesignToCatalog(d, {
      name: 'Hall chest',
      room: 'hallway',
      function: 'storage',
    });
    if (!('template' in res)) throw new Error(res.error);
    expect(res.template.family).toMatchObject({
      name: 'Hall chest',
      rooms: ['hallway'],
      function: 'storage',
    });
    expect((await db.listTemplates()).map((x) => x.id)).toEqual([res.template.id]);
  });

  it('an empty name is refused in the user’s words', async () => {
    const res = await saveDesignToCatalog(templates[0].create(), {
      name: ' ',
      room: 'other',
      function: 'storage',
    });
    expect(res).toEqual({ error: 'Give the template a name.' });
  });
});
