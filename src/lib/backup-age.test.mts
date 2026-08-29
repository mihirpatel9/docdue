import { backupAgeInDays, backupAgeLabel } from '../db/settings.ts';

let pass = 0, fail = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
};

const now = new Date(2026, 7, 29, 14, 0); // 29 Aug 2026, local afternoon
const iso = (y: number, m: number, d: number) => new Date(y, m, d, 9, 0).toISOString();

// --- age in days ----------------------------------------------------------
check('never backed up is null', backupAgeInDays(null, now), null);
check('today is 0', backupAgeInDays(iso(2026, 7, 29), now), 0);
check('yesterday is 1', backupAgeInDays(iso(2026, 7, 28), now), 1);
check('a week ago', backupAgeInDays(iso(2026, 7, 22), now), 7);

// A corrupt stored value must not read as "recently backed up" — that would
// reassure exactly the person who has no backup at all.
check('unparseable date is null', backupAgeInDays('not-a-date', now), null);
check('empty string is null', backupAgeInDays('', now), null);

// --- labels ---------------------------------------------------------------
check('never', backupAgeLabel(null, now), 'Never backed up');
check('today', backupAgeLabel(iso(2026, 7, 29), now), 'Backed up today');
check('yesterday', backupAgeLabel(iso(2026, 7, 28), now), 'Backed up yesterday');
check('days', backupAgeLabel(iso(2026, 7, 17), now), 'Backed up 12 days ago');
check('one month', backupAgeLabel(iso(2026, 6, 25), now), 'Backed up a month ago');
check('several months', backupAgeLabel(iso(2026, 3, 1), now), 'Backed up 5 months ago');
check('corrupt value reads as never', backupAgeLabel('garbage', now), 'Never backed up');

// A clock that moved backwards (timezone change, manual adjustment) must not
// produce "Backed up -3 days ago".
check('future timestamp clamps to today', backupAgeLabel(iso(2026, 8, 5), now), 'Backed up today');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
