/**
 * Everything in this app hangs off one question: how many days until this
 * expires? Calendar arithmetic, not timestamp arithmetic — see below.
 */

import type { ThemeColor } from '@/constants/theme';

export type Urgency = 'expired' | 'critical' | 'soon' | 'ok';

/** Today as an ISO calendar date in the device's own timezone. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Whole days from `fromIso` to `toIso`, both ISO calendar dates.
 *
 * Both ends are parsed as UTC midnight purely so the subtraction is clean —
 * that is a calculation detail, not storage. Using local Date parsing here
 * would make the result wobble by a day across DST boundaries, which is how
 * "expires in 30 days" quietly becomes 29.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/** Days until a document expires. Negative means it already has. */
export function daysUntilExpiry(expiresOn: string, now: Date = new Date()): number {
  return daysBetween(todayIso(now), expiresOn);
}

export function urgencyOf(daysLeft: number): Urgency {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 7) return 'critical';
  if (daysLeft <= 30) return 'soon';
  return 'ok';
}

/**
 * Urgency resolves to theme token NAMES, not hex values — the same "expired" red
 * has to be legible on a white card and on a near-black one, and only the theme
 * knows which is in play.
 */
export const URGENCY_TOKENS: Record<Urgency, { fg: ThemeColor; surface: ThemeColor }> = {
  expired: { fg: 'danger', surface: 'dangerSurface' },
  critical: { fg: 'warning', surface: 'warningSurface' },
  soon: { fg: 'caution', surface: 'cautionSurface' },
  ok: { fg: 'success', surface: 'successSurface' },
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  expired: 'Expired',
  critical: 'This week',
  soon: 'This month',
  ok: 'Later',
};

/** Human phrasing for the list row. Plain language, no jargon. */
export function expiryLabel(daysLeft: number): string {
  if (daysLeft < -1) return `Expired ${Math.abs(daysLeft)} days ago`;
  if (daysLeft === -1) return 'Expired yesterday';
  if (daysLeft === 0) return 'Expires today';
  if (daysLeft === 1) return 'Expires tomorrow';
  if (daysLeft < 31) return `Expires in ${daysLeft} days`;

  const months = Math.round(daysLeft / 30);
  if (daysLeft < 365) return `Expires in about ${months} month${months === 1 ? '' : 's'}`;

  const years = Math.round(daysLeft / 365);
  return `Expires in about ${years} year${years === 1 ? '' : 's'}`;
}

/**
 * The same fact compressed for the card's corner badge, where there is room for
 * roughly six characters and no room for a sentence.
 */
export function expiryBadge(daysLeft: number): string {
  if (daysLeft < 0) return 'Expired';
  if (daysLeft === 0) return 'Today';
  if (daysLeft === 1) return '1 day';
  if (daysLeft < 31) return `${daysLeft} days`;
  if (daysLeft < 365) return `${Math.round(daysLeft / 30)} mo`;
  return `${Math.round(daysLeft / 365)} yr`;
}

/**
 * How full the ring around a document's icon is drawn: 1.0 a year or more out,
 * emptying as the date approaches. Clamped at both ends so an expired passport
 * and one that lapsed in 2009 look the same rather than inverting.
 */
export function expiryProgress(daysLeft: number, horizonDays = 365): number {
  if (daysLeft <= 0) return 0;
  return Math.min(1, daysLeft / horizonDays);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Formats an ISO calendar date for display, split by hand rather than through
 * `new Date(iso)` — that parses yyyy-mm-dd as UTC midnight and then renders it
 * in local time, printing the previous day for everyone west of Greenwich.
 */
export function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, y, m, d] = match;
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function formatIsoDateShort(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, y, m, d] = match;
  return `${Number(d)} ${MONTHS[Number(m) - 1].slice(0, 3)} ${y}`;
}
