/**
 * The parts of the backup format that are pure string handling.
 *
 * Split out from `vault-export.ts` so they can be tested under plain Node —
 * that file reaches for expo-sqlite and expo-file-system on import, which a
 * test runner has no way to provide. The escaping below is the kind of thing
 * that must be tested rather than reasoned about once and trusted.
 */

/**
 * The schema version a backup file carries, so a file written by a newer build
 * is refused instead of half-read. Mirrors DATABASE_VERSION in migrations.ts.
 */
export const BACKUP_SCHEMA_VERSION = 3;

export const FILE_EXTENSION = 'evault';
export const MIME_TYPE = 'application/octet-stream';

/**
 * Shortest passphrase the app will accept.
 *
 * SQLCipher runs PBKDF2-HMAC-SHA512 at 256,000 iterations, which makes each
 * guess expensive but not impossible — the passphrase is the ONLY thing
 * standing between this file and whoever ends up holding it, because unlike the
 * vault on the phone there is no hardware keystore behind it. Twelve characters
 * is where an offline attack on that KDF stops being worth running.
 */
export const MIN_PASSPHRASE_LENGTH = 12;

/**
 * Escapes a value for a SQL string literal by doubling single quotes.
 *
 * This is not decoration. `PRAGMA key` and `ATTACH ... KEY` take a literal, not
 * a bound parameter — SQLite will not let you bind either — so an apostrophe in
 * someone's passphrase would otherwise terminate the string and turn the rest
 * of it into syntax. Doubling is the escape SQLite defines, and it is why a
 * passphrase of `it's fine` keys the file as `it's fine` rather than failing or,
 * worse, keying it as something shorter than the user typed.
 */
export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * ATTACH wants a filesystem path. `expo-file-system` deals in `file://` URIs,
 * and handing one straight to SQLite creates a database in a directory
 * literally named `file:`.
 */
export function toDatabasePath(uri: string): string {
  const path = uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
  return decodeURIComponent(path);
}

/** `docdue-2026-08-28.evault` — sorts chronologically in a file list. */
export function backupFilename(now: Date): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `docdue-${stamp}.${FILE_EXTENSION}`;
}

export type PassphraseStrength = 'too-short' | 'weak' | 'fair' | 'strong';

/**
 * Rates a passphrase on length and variety. Deliberately not a percentage or a
 * coloured meter pretending to be entropy — the honest signal here is "long
 * enough and mixed enough", and anything more precise would be theatre.
 */
export function ratePassphrase(passphrase: string): PassphraseStrength {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) return 'too-short';

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(passphrase)
  ).length;

  if (passphrase.length >= 20 || (passphrase.length >= 16 && classes >= 3)) return 'strong';
  if (classes >= 2) return 'fair';
  return 'weak';
}

export const STRENGTH_LABELS: Record<PassphraseStrength, string> = {
  'too-short': `At least ${MIN_PASSPHRASE_LENGTH} characters`,
  weak: 'Weak — add numbers or symbols',
  fair: 'Fair',
  strong: 'Strong',
};
