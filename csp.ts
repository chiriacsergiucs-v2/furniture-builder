/**
 * The page's Content-Security-Policy (ADR-131), as a meta tag: GitHub Pages cannot set headers. Only the app's own
 * origin, plus the backend origin of this build (`VITE_SUPABASE_URL`, ADR-126, ADR-127) for requests. Built here so
 * `vite.config.ts` and `tests/security.test.ts` use the same text.
 */
export function backendOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(backendUrl?: string): string {
  const api = backendOrigin(backendUrl);
  return [
    "default-src 'self'",
    "script-src 'self'",
    // React and three.js set inline style attributes and the 3D canvas adds style rules.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${api ? ` ${api}` : ''}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
