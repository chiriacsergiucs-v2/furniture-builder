import { sellerImageAllowed } from './sellerOrigins';

/**
 * ADR-161: downloads a seller's product picture once, when the user picks that product for a board, so it becomes
 * the board's picture on this device (ADR-048). Only from the seller origins; the seller's site must allow it (CORS).
 * Returns the file, or null when it cannot be had (offline, blocked, not a picture).
 */
export async function fetchSellerPicture(url: string, name: string): Promise<File | null> {
  if (!sellerImageAllowed(url)) return null;
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
