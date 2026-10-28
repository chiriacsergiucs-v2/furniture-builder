/**
 * The only runtime third-party origins the app may contact (ADR-126). Everything online lives in `src/online` and
 * is loaded lazily after the user opts in (G-215); the offline core never imports this folder statically.
 * The backend origin comes from the build (`VITE_SUPABASE_URL`, ADR-127); without it no online feature is offered.
 */
export function onlineOrigins(
  url: string | undefined = import.meta.env.VITE_SUPABASE_URL,
): string[] {
  if (!url) return [];
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? [u.origin] : [];
  } catch {
    return [];
  }
}

/** Whether this build has a backend at all: online features are hidden when it does not. */
export const onlineConfigured = (url?: string): boolean => onlineOrigins(url).length > 0;
