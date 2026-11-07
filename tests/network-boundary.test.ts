import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isHttpsOrigin } from '../src/core/origin';
import { onlineConfigured, onlineOrigins } from '../src/online/origins';
import { backendConfigured } from '../src/store/accountStore';

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

// ADR-233: remote loads that are not a fetch. Matched on the source with comments stripped, so a URL in a comment
// is not a hit. A remote picture is only a hit with an http(s) literal: a `new Image()` fed a local blob or data URL
// (`ui/wallPictures.ts`) loads nothing from the network. `href` is not matched (a link is opened by the user). A
// block comment starts only after whitespace or punctuation, so a glob such as `'./*.json'` is not taken for one.
const stripComments = (code: string): string =>
  code.replace(/(^|[\s{}();,])\/\*[\s\S]*?\*\//g, '$1').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
const REMOTE_LOAD: Record<string, RegExp> = {
  'remote new Image': /\bnew\s+Image\b[^;]*?['"`]https?:\/\//,
  'remote src': /\bsrc\s*[=:]\s*\{?\s*['"`]https?:\/\//,
  'remote import()': /\bimport\s*\(\s*['"`]https?:/,
  '@supabase outside src/online': /['"`]@supabase\//,
};
// The service worker is registered once, by the PWA plugin's `registerSW` in `main.tsx` (ADR-012); nothing else
// outside `src/online` may reach it (it could cache or fetch remote URLs).
const SERVICE_WORKER = /\bnavigator\s*\.\s*serviceWorker\b/;
const SW_REGISTRATION = 'main.tsx';
const remoteHits = (code: string): string[] => {
  const c = stripComments(code);
  return Object.entries(REMOTE_LOAD)
    .filter(([, re]) => re.test(c))
    .map(([name]) => name);
};

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

  it('no module outside src/online loads a remote picture, script or the backend library (ADR-233)', () => {
    const hits = outside.flatMap((f) =>
      remoteHits(readFileSync(f, 'utf8')).map((h) => `${relative(SRC, f)}: ${h}`),
    );
    expect(hits).toEqual([]);
  });

  it('only the PWA registration file reaches the service worker (ADR-233)', () => {
    const hits = outside.filter(
      (f) =>
        relative(SRC, f) !== SW_REGISTRATION &&
        SERVICE_WORKER.test(stripComments(readFileSync(f, 'utf8'))),
    );
    expect(hits.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('the boundary test itself catches each remote load (ADR-233)', () => {
    expect(remoteHits("const i = new Image(); i.src = 'https://x.co/a.png';")).toContain(
      'remote src',
    );
    expect(remoteHits("new Image().src = 'https://x.co/a.png';")).toContain('remote new Image');
    expect(remoteHits('<img src="https://x.co/a.png" alt="" />')).toEqual(['remote src']);
    expect(remoteHits("<img src={'http://x.co/a.png'} alt='' />")).toEqual(['remote src']);
    expect(remoteHits("h('img', { src: 'https://x.co/a.png' })")).toEqual(['remote src']);
    expect(remoteHits("const m = await import('https://esm.sh/x');")).toEqual(['remote import()']);
    expect(remoteHits("import { createClient } from '@supabase/supabase-js';")).toEqual([
      '@supabase outside src/online',
    ]);
    expect(remoteHits("const m = await import('@supabase/supabase-js');")).toEqual([
      '@supabase outside src/online',
    ]);
    expect(SERVICE_WORKER.test('navigator.serviceWorker.register(url)')).toBe(true);
    // Not hits: a local picture, a link, a comment, a relative import.
    expect(remoteHits('const el = new Image(); el.src = blobUrl;')).toEqual([]);
    expect(remoteHits('<a href="https://x.co">x</a>')).toEqual([]);
    expect(remoteHits("// el.src = 'https://x.co/a.png'\n/* import('https://x') */")).toEqual([]);
    expect(remoteHits("const m = await import('./viewer/Preview');")).toEqual([]);
    expect(remoteHits("const u = 'https://x.co'; // see https://x.co")).toEqual([]);
    expect(stripComments("glob(['./*.json']); */ x")).toBe("glob(['./*.json']); */ x");
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

// ADR-233: one rule for "an https backend origin", shared by the store (no import of src/online) and src/online.
describe('one https origin rule (ADR-233)', () => {
  afterEach(() => vi.unstubAllEnvs());
  const FIXTURES: [string | undefined, boolean][] = [
    [undefined, false],
    ['', false],
    ['https://', false],
    ['http://x.co', false],
    ['not a url', false],
    ['https://x.supabase.co', true],
  ];

  it.each(FIXTURES)('%j: isHttpsOrigin, onlineOrigins and backendConfigured agree', (url, want) => {
    expect(isHttpsOrigin(url)).toBe(want);
    expect(onlineOrigins(url).length > 0).toBe(want);
    vi.stubEnv('VITE_SUPABASE_URL', url as string);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
    expect(backendConfigured()).toBe(want);
  });

  it('backendConfigured is false without the public key', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(backendConfigured()).toBe(false);
  });
});
