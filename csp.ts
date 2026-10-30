import { SELLER_IMAGE_ORIGINS } from './src/online/sellerOrigins';

/**
 * The page's Content-Security-Policy (ADR-131), as a meta tag: GitHub Pages cannot set headers. Only the app's own
 * origin, plus the backend origin of this build (`VITE_SUPABASE_URL`, ADR-126, ADR-127) for requests, and the
 * seller picture origins (ADR-161). Built here so
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
    // Seller pictures, loaded only after the user switches them on (ADR-161).
    `img-src 'self' data: blob: ${SELLER_IMAGE_ORIGINS.join(' ')}`,
    "font-src 'self' data:",
    // Seller pictures are downloaded once when picked for a board (ADR-161).
    `connect-src 'self'${api ? ` ${api}` : ''} ${SELLER_IMAGE_ORIGINS.join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
