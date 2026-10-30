import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backendOrigin, contentSecurityPolicy } from '../csp';
import { SELLER_IMAGE_ORIGINS, sellerImageAllowed } from '../src/online/sellerOrigins';

// ADR-131: the content security policy, no secret key in the app, and a service worker that never caches online
// responses.
const ROOT = new URL('..', import.meta.url).pathname;
const files = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory()
          ? files(p)
          : /\.(ts|tsx|js|mjs|html|json)$/.test(n)
            ? [p]
            : [];
      })
    : [];
// A Supabase service-role JWT names its role in the payload; new-style secret keys start with sb_secret_.
const SECRET =
  /service_role|sb_secret_[A-Za-z0-9]|SUPABASE_SERVICE|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl/;

describe('content security policy (ADR-131)', () => {
  it('allows only the app itself and the seller picture origins without a backend', () => {
    const p = contentSecurityPolicy(undefined);
    // ADR-160: seller pictures are shown on product lists and downloaded once when picked for a board.
    expect(p).toContain("connect-src 'self' https://regencycompany.ro;");
    expect(p).toContain("img-src 'self' data: blob: https://regencycompany.ro;");
    expect(p).toContain("script-src 'self';");
    expect(p).toContain("object-src 'none'");
    expect(p.match(/https?:\/\/[^\s;]+/g)).toEqual(SELLER_IMAGE_ORIGINS.flatMap((o) => [o, o]));
  });
  it('adds only the backend origin, https only', () => {
    expect(contentSecurityPolicy('https://abc.supabase.co/rest/v1')).toContain(
      "connect-src 'self' https://abc.supabase.co https://regencycompany.ro;",
    );
    expect(contentSecurityPolicy('http://abc.supabase.co')).toContain(
      "connect-src 'self' https://regencycompany.ro;",
    );
    expect(backendOrigin('nope')).toBeNull();
  });
  it('seller pictures load only from the seller origins, over https (ADR-160)', () => {
    expect(SELLER_IMAGE_ORIGINS).toEqual(['https://regencycompany.ro']);
    expect(sellerImageAllowed('https://regencycompany.ro/media/x.jpg')).toBe(true);
    expect(sellerImageAllowed('http://regencycompany.ro/media/x.jpg')).toBe(false);
    expect(sellerImageAllowed('https://evil.example/x.jpg')).toBe(false);
    expect(sellerImageAllowed('https://regencycompany.ro.evil.example/x.jpg')).toBe(false);
    expect(sellerImageAllowed('not a url')).toBe(false);
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
