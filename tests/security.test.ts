import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backendOrigin, contentSecurityPolicy } from '../csp';

// ADR-131: the content security policy, no secret key in the app, and a service worker that never caches online
// responses.
const ROOT = new URL('..', import.meta.url).pathname;
const files = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|js|mjs|html|json)$/.test(n) ? [p] : [];
      })
    : [];
// A Supabase service-role JWT names its role in the payload; new-style secret keys start with sb_secret_.
const SECRET = /service_role|sb_secret_[A-Za-z0-9]|SUPABASE_SERVICE|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl/;

describe('content security policy (ADR-131)', () => {
  it('allows only the app itself without a backend', () => {
    const p = contentSecurityPolicy(undefined);
    expect(p).toContain("connect-src 'self';");
    expect(p).toContain("script-src 'self';");
    expect(p).toContain("object-src 'none'");
    expect(p).not.toMatch(/https?:\/\//);
  });
  it('adds only the backend origin, https only', () => {
    expect(contentSecurityPolicy('https://abc.supabase.co/rest/v1')).toContain(
      "connect-src 'self' https://abc.supabase.co;",
    );
    expect(contentSecurityPolicy('http://abc.supabase.co')).toContain("connect-src 'self';");
    expect(backendOrigin('nope')).toBeNull();
  });
  it('the built page carries it, first in <head>, when a build exists', () => {
    const html = join(ROOT, 'dist/index.html');
    if (!existsSync(html)) return;
    const text = readFileSync(html, 'utf8');
    expect(text).toMatch(/<meta charset="UTF-8" \/>\s*<meta http-equiv="Content-Security-Policy"/);
  });
});

describe('no secret key in the app (ADR-131)', () => {
  it('src/ and, when built, dist/ hold no service or secret key', () => {
    const hits = [...files(join(ROOT, 'src')), ...files(join(ROOT, 'dist'))].filter((f) =>
      SECRET.test(readFileSync(f, 'utf8')),
    );
    expect(hits).toEqual([]);
  });
  it('the pattern catches a service-role key', () => {
    expect(SECRET.test('const k = "sb_secret_abc123"')).toBe(true);
    expect(SECRET.test('role: service_role')).toBe(true);
  });
});

describe('service worker (ADR-131)', () => {
  it('caches only the app’s own files: no runtime caching of online responses', () => {
    const cfg = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(cfg).not.toContain('runtimeCaching');
    const sw = join(ROOT, 'dist/sw.js');
    if (existsSync(sw)) expect(readFileSync(sw, 'utf8')).not.toMatch(/supabase\.co/);
  });
});
