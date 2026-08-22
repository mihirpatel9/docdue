import { buildSections, summarise, type Filters } from './grouping.ts';
import type { DocumentRow } from '../db/types.ts';

let pass = 0, fail = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
};

// A fixed "now" so these never go stale.
const now = new Date(2026, 7, 22, 14, 30); // 22 Aug 2026

const doc = (over: Partial<DocumentRow> & { id: string; title: string; expires_on: string }): DocumentRow => ({
  user_id: null, kind: 'other', issuer: null, reference: null, issued_on: null,
  notes: null, image_path: null, created_at: '', updated_at: '', deleted_at: null,
  synced_at: null, ...over,
} as DocumentRow);

const docs: DocumentRow[] = [
  doc({ id: '1', title: 'Lapsed licence', expires_on: '2026-06-01', kind: 'drivers_license' }),
  doc({ id: '2', title: 'Car rego', expires_on: '2026-08-26', kind: 'vehicle_registration', issuer: 'Service NSW' }),
  doc({ id: '3', title: 'Home insurance', expires_on: '2026-09-10', kind: 'insurance', reference: 'POL-9931' }),
  doc({ id: '4', title: 'Australian passport', expires_on: '2031-01-04', kind: 'passport', notes: 'Renew at the post office' }),
];

const filters = (over: Partial<Filters> = {}): Filters =>
  ({ query: '', kinds: [], urgencies: [], sort: 'expiry', ...over });

const shape = (sections: ReturnType<typeof buildSections>) =>
  sections.map((s) => [s.urgency, s.data.map((d) => d.id)]);

// --- bucketing ---------------------------------------------------------------
check('sections run expired first, then by nearness',
  shape(buildSections(docs, filters(), { showExpired: true, now })),
  [['expired', ['1']], ['critical', ['2']], ['soon', ['3']], ['ok', ['4']]]);

// --- search ------------------------------------------------------------------
check('query matches title', shape(buildSections(docs, filters({ query: 'passport' }), { showExpired: true, now })),
  [['ok', ['4']]]);
check('query matches issuer', shape(buildSections(docs, filters({ query: 'service nsw' }), { showExpired: true, now })),
  [['critical', ['2']]]);
check('query matches reference', shape(buildSections(docs, filters({ query: 'POL-99' }), { showExpired: true, now })),
  [['soon', ['3']]]);
check('query matches notes', shape(buildSections(docs, filters({ query: 'post office' }), { showExpired: true, now })),
  [['ok', ['4']]]);
check('blank query keeps everything', buildSections(docs, filters({ query: '   ' }), { showExpired: true, now }).length, 4);

// --- filters -----------------------------------------------------------------
check('kind filter', shape(buildSections(docs, filters({ kinds: ['passport', 'insurance'] }), { showExpired: true, now })),
  [['soon', ['3']], ['ok', ['4']]]);
check('urgency filter', shape(buildSections(docs, filters({ urgencies: ['expired'] }), { showExpired: true, now })),
  [['expired', ['1']]]);

// --- the showExpired preference ---------------------------------------------
check('showExpired off hides lapsed documents',
  shape(buildSections(docs, filters(), { showExpired: false, now })),
  [['critical', ['2']], ['soon', ['3']], ['ok', ['4']]]);
check('an explicit Expired chip overrides showExpired off',
  shape(buildSections(docs, filters({ urgencies: ['expired'] }), { showExpired: false, now })),
  [['expired', ['1']]]);

// --- sorting -----------------------------------------------------------------
const sameWeek: DocumentRow[] = [
  doc({ id: 'b', title: 'Bravo', expires_on: '2026-08-27' }),
  doc({ id: 'a', title: 'Alpha', expires_on: '2026-08-28' }),
];
check('default sort is soonest first',
  shape(buildSections(sameWeek, filters(), { showExpired: true, now })), [['critical', ['b', 'a']]]);
check('title sort reorders within a section',
  shape(buildSections(sameWeek, filters({ sort: 'title' }), { showExpired: true, now })), [['critical', ['a', 'b']]]);
check('title sort does not merge sections',
  shape(buildSections(docs, filters({ sort: 'title' }), { showExpired: true, now })).length, 4);

// --- summary -----------------------------------------------------------------
check('summary counts the whole vault', summarise(docs, now),
  { expired: 1, critical: 1, soon: 1, ok: 1, total: 4 });
check('summary of an empty vault', summarise([], now),
  { expired: 0, critical: 0, soon: 0, ok: 0, total: 0 });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
