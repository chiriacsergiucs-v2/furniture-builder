import { sellerImageAllowed } from './sellerOrigins';

/**
 * ADR-161/ADR-162: gets a product picture once, when the user picks that product for a board, so it becomes the
 * board's picture on this device (ADR-048). The app's own copy (same origin) is used when it ships one; otherwise
 * the seller's site, which must allow it (CORS). Returns the file, or null when it cannot be had.
 */
export async function fetchSellerPicture(url: string, name: string): Promise<File | null> {
  if (!sellerImageAllowed(url) && !sameOrigin(url)) return null;
  try {
    const r = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!blob.type.startsWith('image/')) return null;
    return new File([blob], name, { type: blob.type });
  } catch {
    return null;
  }
}

/** A path or URL on the app's own origin (the shipped board pictures, ADR-162). */
function sameOrigin(url: string): boolean {
  try {
    return new URL(url, location.href).origin === location.origin;
  } catch {
    return false;
  }
}
