import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { onlineConfigured, onlineOrigins } from '../src/online/origins';

// ADR-126: the offline core sends nothing. Only `src/online` may make requests, and the rest of the app reaches it
// only through a dynamic import (a lazy chunk loaded after the user opts in, G-215).
const SRC = new URL('../src', import.meta.url).pathname;
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
const outside = files(SRC).filter((f) => !relative(SRC, f).startsWith('online/'));
const REQUEST = /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|sendBeacon|EventSource/;
const STATIC_ONLINE = /^\s*(import|export)\s[^;]*?from\s+['"][^'"]*\/online\//m;

describe('network boundary (ADR-126)', () => {
  it('no module outside src/online makes a request', () => {
    const hits = outside.filter((f) => REQUEST.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('no module outside src/online imports it statically', () => {
    const hits = outside.filter((f) => STATIC_ONLINE.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('the boundary test itself catches a request and a static import', () => {
    expect(REQUEST.test('await fetch(url)')).toBe(true);
    expect(REQUEST.test('navigator.sendBeacon(u, d)')).toBe(true);
    expect(STATIC_ONLINE.test("import { x } from '../online/session';")).toBe(true);
    expect(STATIC_ONLINE.test("const m = await import('../online/session');")).toBe(false);
  });

  it('allowed origins: only an https backend from the build, else none', () => {
    expect(onlineOrigins(undefined)).toEqual([]);
    expect(onlineOrigins('')).toEqual([]);
    expect(onlineOrigins('http://example.supabase.co')).toEqual([]);
    expect(onlineOrigins('not a url')).toEqual([]);
    expect(onlineOrigins('https://abc.supabase.co/rest/v1')).toEqual(['https://abc.supabase.co']);
    expect(onlineConfigured('https://abc.supabase.co')).toBe(true);
    expect(onlineConfigured('')).toBe(false);
  });
});
