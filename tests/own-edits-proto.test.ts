import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { settingsDiff } from '../src/core/ownEdits';
import type { Design } from '../src/core/types';

/** L-3 (security scan): a parsed `__proto__` key must not become the prototype of a copied object. */
describe('ownEdits and __proto__ keys', () => {
  it('settingsDiff ignores a parsed __proto__ key and leaves prototypes alone', () => {
    const base = templates[0].create();
    const mk = (params: string): Design =>
      ({ ...base, product: { kind: 'x', params: JSON.parse(params) } }) as unknown as Design;
    const tpl = mk('{"__proto__":{"polluted":true},"a":1}');
    const piece = mk('{"__proto__":{"polluted":true},"a":2}');
    expect(Object.keys(piece.product.params)).toContain('__proto__');
    const out = settingsDiff(tpl, piece);
    expect(out).toEqual({ a: 2 });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
