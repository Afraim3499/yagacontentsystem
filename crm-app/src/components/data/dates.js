// Shared date helpers for the CRM data tables.
//
// Dates in Supabase are ISO-8601 timestamptz strings. The codebase used to
// parse them ad hoc with `new Date(str)` and display them with
// `toLocaleDateString()` (which varies by the operator's browser locale and
// timezone). These helpers centralise that and give one stable format.

/** Parse an ISO string to a Date, or null. Accepts Date passthrough. */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

/** Locale-stable YYYY-MM-DD (UTC). Empty string for no date. */
export function fmtDate(value) {
  const d = parseDate(value);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

/** Human-ish "Mar 4, 2026" — still locale-stable (fixed en-US, UTC). */
export function fmtDateNice(value) {
  const d = parseDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** For an <input type="date"> value. */
export function toDateInput(value) {
  return fmtDate(value);
}

/** Start of the given YYYY-MM-DD (00:00:00 UTC) as an ISO string, or null. */
export function startOfDayISO(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return isNaN(d) ? null : d.toISOString();
}

/** End of the given YYYY-MM-DD (23:59:59.999 UTC) as an ISO string, or null. */
export function endOfDayISO(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T23:59:59.999Z`);
  return isNaN(d) ? null : d.toISOString();
}

/** Whole days from now until `value` (negative = in the past), or null. */
export function daysUntil(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

/** Short relative time in the past: "just now", "3h ago", "2d ago", "5w ago". "—" for none. */
export function relTime(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return '—';
  const secs = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (secs < 90) return 'just now';
  const mins = secs / 60;
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  const days = hrs / 24;
  if (days < 14) return `${Math.round(days)}d ago`;
  const weeks = days / 7;
  if (weeks < 9) return `${Math.round(weeks)}w ago`;
  const months = days / 30;
  if (months < 18) return `${Math.round(months)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

const EXPIRING_WINDOW_DAYS = 7;

/**
 * The authoritative subscription status, computed from the expiration date
 * rather than the stored `subscription_status` column (which is `ACTIVE` on
 * every row in the live DB and therefore useless).
 *
 * Returns 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED'. Non-VIP members and members
 * with no expiration date fall back to 'ACTIVE'.
 */
export function computeLiveStatus(member, now = new Date()) {
  const tier = member?.member_tier || '';
  if (!/VIP/i.test(tier)) return 'ACTIVE';
  const exp = parseDate(member?.subscription_expiration_date);
  if (!exp) return 'ACTIVE';
  const days = Math.ceil((exp.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return 'EXPIRED';
  if (days <= EXPIRING_WINDOW_DAYS) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

export const LIVE_STATUS_LABEL = {
  ACTIVE: 'Active',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRED: 'Expired',
};
