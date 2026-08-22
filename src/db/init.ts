import type { SQLiteDatabase } from 'expo-sqlite';

import { getOrCreateDatabaseKey } from '@/lib/secure-key';

import { migrateDbIfNeeded } from './migrations';

export class DatabaseNotEncryptedError extends Error {
  constructor() {
    super(
      'This build has no SQLCipher support, so the vault cannot be encrypted. ' +
        'Run it as a development build (npx expo run:android / run:ios), not in Expo Go.'
    );
    this.name = 'DatabaseNotEncryptedError';
  }
}

/**
 * Opens the vault. Order is not negotiable: key first, prove the key took
 * effect, then migrate.
 *
 * The proof step exists because of a genuinely dangerous failure mode — plain
 * SQLite silently IGNORES `PRAGMA key`. It does not throw, it does not warn, it
 * returns success and writes your data to disk in the clear. Without this check
 * the app would look encrypted, test as encrypted, and ship as plaintext.
 * `PRAGMA cipher_version` returns a row only on a real SQLCipher build, so it
 * is the one honest signal available.
 *
 * On failure we refuse to continue rather than degrade. An unencrypted fallback
 * is exactly the sort of well-meaning escape hatch that ends up in production.
 */
export async function openVault(db: SQLiteDatabase): Promise<void> {
  const key = await getOrCreateDatabaseKey();

  // Must be the first statement on the connection, before any read or write.
  // The x'...' form means "use these bytes as the key", skipping derivation.
  await db.execAsync(`PRAGMA key = "x'${key}'"`);

  const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!cipher?.cipher_version) throw new DatabaseNotEncryptedError();

  // Proves the key is the RIGHT one, not merely that SQLCipher is present. With
  // a wrong key every subsequent statement fails with "file is not a database";
  // failing here gives a comprehensible error instead of that.
  await db.getFirstAsync('SELECT count(*) FROM sqlite_master');

  await migrateDbIfNeeded(db);
}
