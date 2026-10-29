/**
 * Design codes (ADR-124): a design or project as a compact text code and a link that opens it, to move it to another
 * device without a file. The code is the document as saved, compressed with the browser's own `CompressionStream`
 * (deflate) and written in base64url — no dependency and no network (ADR-002). Reading a code never throws: a damaged
 * one is a message. The caller validates the document before it is stored and gives it a new id (ADR-011).
 */

import { t } from './i18n';

/** Codes start with this, so a pasted text is recognised (and a later format can take another prefix). */
export const CODE_PREFIX = 'FB1-';
/** The link form: `<app address>#open=<code>`. */
export const LINK_KEY = '#open=';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as Uint8Array<ArrayBuffer>).catch(() => undefined);
  void writer.close().catch(() => undefined);
  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The code for a design or project document. */
export async function encodeCode(doc: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(doc));
  return CODE_PREFIX + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
}

/** The link that opens the code in the app at `base` (the address without its #part). */
export const codeLink = (base: string, code: string) => `${base.split('#')[0]}${LINK_KEY}${code}`;

/** The code inside a pasted text: the code itself or a link holding it, spaces and line breaks ignored. */
export function codeIn(text: string): string | null {
  const t = text.replace(/\s+/g, '');
  const at = t.indexOf(LINK_KEY);
  const code = at >= 0 ? t.slice(at + LINK_KEY.length) : t;
  return code.startsWith(CODE_PREFIX) ? code : null;
}

export type Decoded = { ok: true; doc: unknown } | { ok: false; error: string };

/** The document in a code or link; a message when it is not one or is damaged. */
export async function decodeCode(text: string): Promise<Decoded> {
  const code = codeIn(text);
  if (!code) return { ok: false, error: t('That is not a design code. Codes start with FB1-.') };
  const bytes = fromBase64Url(code.slice(CODE_PREFIX.length));
  if (!bytes || !bytes.length)
    return { ok: false, error: t('That code is damaged: copy it again in full.') };
  try {
    const json = new TextDecoder().decode(
      await pipe(bytes, new DecompressionStream('deflate-raw')),
    );
    return { ok: true, doc: JSON.parse(json) as unknown };
  } catch {
    return { ok: false, error: t('That code is damaged: copy it again in full.') };
  }
}
