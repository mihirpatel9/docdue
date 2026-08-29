import {
  MIN_PASSPHRASE_LENGTH,
  backupFilename,
  ratePassphrase,
  sqlLiteral,
  toDatabasePath,
} from './backup-format.ts';

let pass = 0, fail = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
};

// --- SQL literal escaping -------------------------------------------------
// This is the security-critical one. The passphrase cannot be bound as a
// parameter — SQLite forbids it on PRAGMA and ATTACH — so it is interpolated,
// and the escaping is the only thing between a punctuation mark and a broken
// or truncated key.

check('plain passphrase', sqlLiteral('correcthorsebattery'), "'correcthorsebattery'");
check("apostrophe is doubled", sqlLiteral("it's fine"), "'it''s fine'");
check('multiple apostrophes', sqlLiteral("o''clock"), "'o''''clock'");

// The one that matters: a passphrase ending in a quote must not close the
// literal early and leave `; DROP` sitting in statement position.
check(
  'quote cannot terminate the literal',
  sqlLiteral("x'; DROP TABLE documents; --"),
  "'x''; DROP TABLE documents; --'"
);

// Double quotes are not string delimiters in this position and must survive
// untouched — mangling them would key the file as something the user did not type.
check('double quotes pass through', sqlLiteral('say "hello" now'), '\'say "hello" now\'');
check('backslash is not an escape in SQLite', sqlLiteral('back\\slash'), "'back\\slash'");
check('empty string', sqlLiteral(''), "''");

// --- URI to filesystem path ----------------------------------------------
check(
  'strips the file:// scheme',
  toDatabasePath('file:///data/user/0/app/cache/exports/v.evault'),
  '/data/user/0/app/cache/exports/v.evault'
);
check('leaves a bare path alone', toDatabasePath('/tmp/v.evault'), '/tmp/v.evault');
check(
  'decodes percent-encoding',
  toDatabasePath('file:///tmp/My%20Backups/v.evault'),
  '/tmp/My Backups/v.evault'
);

// --- Filename -------------------------------------------------------------
check('filename is date-stamped', backupFilename(new Date(2026, 7, 28)), 'expiry-vault-2026-08-28.evault');
check('month and day are zero-padded', backupFilename(new Date(2026, 0, 5)), 'expiry-vault-2026-01-05.evault');

// --- Passphrase strength --------------------------------------------------
check('below the minimum', ratePassphrase('short'), 'too-short');
check(
  'exactly one under the minimum',
  ratePassphrase('a'.repeat(MIN_PASSPHRASE_LENGTH - 1)),
  'too-short'
);
check('at the minimum, single class', ratePassphrase('a'.repeat(MIN_PASSPHRASE_LENGTH)), 'weak');
check('two classes is fair', ratePassphrase('abcdefghij12'), 'fair');
check('long is strong regardless of variety', ratePassphrase('a'.repeat(20)), 'strong');
check('16 with three classes is strong', ratePassphrase('abcdEFGH12345678'), 'strong');
check('16 with two classes is only fair', ratePassphrase('abcdefgh12345678'), 'fair');
check('a real passphrase', ratePassphrase('Trombone-Sunset-41!'), 'strong');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
