/**
 * The one rule for "an https backend origin" (ADR-233), shared by the store (`backendConfigured`) and `src/online`
 * (`onlineOrigins`). Pure: it parses the text and contacts nothing (ADR-126).
 */
export function isHttpsOrigin(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.host !== '';
  } catch {
    return false;
  }
}
