/**
 * Everything in this app hangs off one question: how many days until this
 * expires? Calendar arithmetic, not timestamp arithmetic — see below.
 */

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

export const URGENCY_COLORS: Record<Urgency, string> = {
  expired: '#DC2626',
  critical: '#EA580C',
  soon: '#CA8A04',
  ok: '#16A34A',
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
