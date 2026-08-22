import { daysUntilExpiry, expiryLabel, todayIso, urgencyOf } from './expiry.ts';

let pass = 0, fail = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
};

// A fixed "now" so these never go stale.
const now = new Date(2026, 7, 22, 14, 30); // 22 Aug 2026, local afternoon

check('todayIso uses local calendar day', todayIso(now), '2026-08-22');
check('same day = 0', daysUntilExpiry('2026-08-22', now), 0);
check('tomorrow = 1', daysUntilExpiry('2026-08-23', now), 1);
check('yesterday = -1', daysUntilExpiry('2026-08-21', now), -1);
check('30 days out', daysUntilExpiry('2026-09-21', now), 30);
check('crosses year boundary', daysUntilExpiry('2027-08-22', now), 365);
check('leap day handled', daysUntilExpiry('2028-02-29', new Date(2028, 1, 28, 9)), 1);

// The DST trap: US clocks change 1 Nov 2026. A naive local-time subtraction
// returns 70.04 days here and floors to 70.
check('spans DST change exactly', daysUntilExpiry('2026-11-02', new Date(2026, 9, 25, 12)), 8);

check('expired', urgencyOf(-3), 'expired');
check('critical at 7', urgencyOf(7), 'critical');
check('soon at 8', urgencyOf(8), 'soon');
check('soon at 30', urgencyOf(30), 'soon');
check('ok at 31', urgencyOf(31), 'ok');

check('label today', expiryLabel(0), 'Expires today');
check('label tomorrow', expiryLabel(1), 'Expires tomorrow');
check('label yesterday', expiryLabel(-1), 'Expired yesterday');
check('label past', expiryLabel(-5), 'Expired 5 days ago');
check('label days', expiryLabel(12), 'Expires in 12 days');
check('label months', expiryLabel(90), 'Expires in about 3 months');
check('label years', expiryLabel(700), 'Expires in about 2 years');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
