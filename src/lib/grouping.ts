import type { DocumentRow, DocumentKind } from '@/db/types';
import { URGENCY_LABELS, daysUntilExpiry, urgencyOf, type Urgency } from './expiry.ts';

export type SortMode = 'expiry' | 'title' | 'kind';

export type Filters = {
  query: string;
  kinds: DocumentKind[];
  urgencies: Urgency[];
  sort: SortMode;
};

export const EMPTY_FILTERS: Filters = { query: '', kinds: [], urgencies: [], sort: 'expiry' };

export function hasActiveFilters(filters: Filters): boolean {
  return filters.kinds.length > 0 || filters.urgencies.length > 0 || filters.sort !== 'expiry';
}

/**
 * Free-text match across every field the user actually typed themselves.
 * Deliberately includes `reference` — searching a policy number is the fastest
 * way to find the right insurance document out of four.
 */
function matchesQuery(doc: DocumentRow, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [doc.title, doc.issuer, doc.reference, doc.notes]
    .filter(Boolean)
    .some((field) => (field as string).toLowerCase().includes(needle));
}

const URGENCY_ORDER: Record<Urgency, number> = { expired: 0, critical: 1, soon: 2, ok: 3 };

/**
 * Generic over the row so the list can pass the joined `DocumentListRow`
 * through and get it back intact. Grouping only ever reads the columns on
 * `DocumentRow`, so widening it here would force every caller to the narrowest
 * shape and cost the list its `has_image` flag.
 */
export type Section<T extends DocumentRow = DocumentRow> = {
  urgency: Urgency;
  title: string;
  data: T[];
};

/**
 * Filters, sorts, then buckets by urgency in one pass so the list and the
 * summary counts can never disagree about what is on screen.
 *
 * Sections come back in urgency order regardless of the sort mode: sorting by
 * title reorders rows *within* "This week", it does not mix a lapsed passport
 * into next year's warranties.
 */
export function buildSections<T extends DocumentRow>(
  documents: T[],
  filters: Filters,
  options: { showExpired: boolean; now?: Date } = { showExpired: true }
): Section<T>[] {
  const now = options.now ?? new Date();

  const visible = documents.filter((doc) => {
    const urgency = urgencyOf(daysUntilExpiry(doc.expires_on, now));

    // An explicit "Expired" filter chip beats the hide-expired preference —
    // the user asking to see them is a clearer instruction than a setting.
    if (!options.showExpired && urgency === 'expired' && !filters.urgencies.includes('expired')) {
      return false;
    }
    if (filters.kinds.length && !filters.kinds.includes(doc.kind)) return false;
    if (filters.urgencies.length && !filters.urgencies.includes(urgency)) return false;
    return matchesQuery(doc, filters.query);
  });

  const compare = (a: T, b: T) => {
    if (filters.sort === 'title') return a.title.localeCompare(b.title);
    if (filters.sort === 'kind') {
      const byKind = a.kind.localeCompare(b.kind);
      if (byKind !== 0) return byKind;
    }
    return a.expires_on.localeCompare(b.expires_on);
  };

  const buckets = new Map<Urgency, T[]>();
  for (const doc of visible) {
    const urgency = urgencyOf(daysUntilExpiry(doc.expires_on, now));
    const bucket = buckets.get(urgency);
    if (bucket) bucket.push(doc);
    else buckets.set(urgency, [doc]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => URGENCY_ORDER[a] - URGENCY_ORDER[b])
    .map(([urgency, data]) => ({
      urgency,
      title: URGENCY_LABELS[urgency],
      data: data.sort(compare),
    }));
}

export type Summary = Record<Urgency, number> & { total: number };

/** Counts for the dashboard header. Always the whole vault, never the filtered view. */
export function summarise(documents: DocumentRow[], now: Date = new Date()): Summary {
  const summary: Summary = { expired: 0, critical: 0, soon: 0, ok: 0, total: documents.length };
  for (const doc of documents) {
    summary[urgencyOf(daysUntilExpiry(doc.expires_on, now))] += 1;
  }
  return summary;
}
