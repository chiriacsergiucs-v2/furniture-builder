// ADR-265 (UI audit, Language) with D04-F5 and D08-F8: a built-in piece name in a core message is in the user's
// language; a name the user typed stays as typed.
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadDictionary, setLang, tr } from '../src/core/i18n';
import { templates } from '../src/core/design';
import { makeItem, newProject, pieceName } from '../src/core/project';

beforeAll(() => loadDictionary('ru'));
afterEach(() => setLang('en'));

describe('piece names in messages (ADR-265)', () => {
  it('pieceName gives a built-in name in Russian and a typed name as typed', () => {
    setLang('ru');
    const d = templates.find((x) => x.id === 'base-door')!.create();
    let p = newProject('P');
    const a = makeItem(p, d);
    p = { ...p, items: [a] };
    expect(pieceName(p, a.id)).toBe(tr(d.name));
    expect(pieceName(p, a.id)).not.toBe(d.name);
    const mine = makeItem(p, { ...d, name: 'Моя тумба' });
    p = { ...p, items: [mine] };
    expect(pieceName(p, mine.id)).toBe('Моя тумба');
  });
});
