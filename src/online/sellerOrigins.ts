/**
 * Seller sites pictures may load from (ADR-161): only after the user switches seller pictures on, and only from
 * these origins. Kept free of build values so the CSP (`csp.ts`) can list them too.
 */
export const SELLER_IMAGE_ORIGINS = ['https://regencycompany.ro'];

/** Whether a picture URL is on an allowed seller origin, over https. */
export function sellerImageAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && SELLER_IMAGE_ORIGINS.includes(u.origin);
  } catch {
    return false;
  }
}
