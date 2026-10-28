/**
 * When the app reminds the user about backups (pure; ADR-140, ADR-141). Times are ISO strings; `now` is passed in.
 */
const DAY = 24 * 60 * 60 * 1000;
const t = (iso?: string) => (iso ? Date.parse(iso) : NaN);

/** The device-only notice comes back this many days after Dismiss (G-261). */
export const NOTICE_SNOOZE_DAYS = 7;

/**
 * "Your designs are only on this device" shows while something is saved, no backup was ever made and nothing is in
 * an account, unless it was dismissed in the last 7 days (ADR-140).
 */
export function deviceNoticeShown(s: {
  savedItems: number;
  lastBackupAt?: string;
  accountCopies: number;
  dismissedAt?: string;
  now: string;
}): boolean {
  if (s.savedItems === 0 || s.lastBackupAt || s.accountCopies > 0) return false;
  const d = t(s.dismissedAt);
  return Number.isNaN(d) || t(s.now) - d >= NOTICE_SNOOZE_DAYS * DAY;
}

/** The reminder intervals offered in Settings › Saved data; 30 days to start with (G-262). 0 = Off. */
export const REMINDER_DAYS = [7, 14, 30, 90, 0] as const;
export const DEFAULT_REMINDER_DAYS = 30;

/**
 * "Last backup: n days ago" is due when the interval is on, something changed since the last backup, the last backup
 * (or, before any, the first save) is older than the interval, and "Later" was not pressed in the last day (ADR-141).
 */
export function reminderDue(s: {
  intervalDays: number;
  lastBackupAt?: string;
  firstSaveAt?: string;
  lastChangeAt?: string;
  laterAt?: string;
  now: string;
}): boolean {
  if (!s.intervalDays || !s.lastChangeAt) return false;
  const since = t(s.lastBackupAt ?? s.firstSaveAt);
  if (Number.isNaN(since)) return false;
  if (s.lastBackupAt && t(s.lastChangeAt) <= since) return false;
  const now = t(s.now);
  if (now - since < s.intervalDays * DAY) return false;
  const later = t(s.laterAt);
  return Number.isNaN(later) || now - later >= DAY;
}

/** Whole days since a time, for "Last backup: n days ago". */
export const daysSince = (iso: string, now: string): number =>
  Math.max(0, Math.floor((t(now) - t(iso)) / DAY));
