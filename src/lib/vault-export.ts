import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_PLAN, type ReminderPlan, rescheduleAll } from '@/db/documents';
import type { DocumentRow } from '@/db/types';

import {
  BACKUP_SCHEMA_VERSION,
  MIN_PASSPHRASE_LENGTH,
  backupFilename,
  sqlLiteral,
  toDatabasePath,
} from './backup-format';

export {
  BACKUP_SCHEMA_VERSION,
  FILE_EXTENSION,
  MIME_TYPE,
  MIN_PASSPHRASE_LENGTH,
  STRENGTH_LABELS,
  ratePassphrase,
  type PassphraseStrength,
} from './backup-format';

export class WrongPassphraseError extends Error {
  constructor() {
    super('That passphrase does not open this backup.');
    this.name = 'WrongPassphraseError';
  }
}

export class IncompatibleBackupError extends Error {
  constructor(found: number) {
    super(
      `This backup was written by a newer version of Expiry Vault (format ${found}, ` +
        `this app reads ${BACKUP_SCHEMA_VERSION}). Update the app and try again.`
    );
    this.name = 'IncompatibleBackupError';
  }
}

export class WeakPassphraseError extends Error {
  constructor() {
    super(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`);
    this.name = 'WeakPassphraseError';
  }
}

/**
 * Writes the whole vault to a single passphrase-encrypted file.
 *
 * The crypto here is SQLCipher's own, reached through `sqlcipher_export()` —
 * the mechanism the library ships for exactly this. The backup is a complete
 * SQLCipher database keyed by the user's passphrase: PBKDF2-HMAC-SHA512 at
 * 256,000 iterations over a random per-file salt, then AES-256-CBC with a
 * per-page HMAC. Nothing about the format is invented here, and no plaintext
 * copy of the vault exists at any point.
 *
 * The main database's own key is untouched. The export is keyed independently,
 * which is the whole reason a backup can survive the phone it came from — the
 * device key is `THIS_DEVICE_ONLY` and deliberately cannot.
 *
 * Returns the file's URI. The caller shares it and is responsible for calling
 * `discardExport` afterwards.
 */
export async function exportVault(
  db: SQLiteDatabase,
  passphrase: string,
  now: Date = new Date()
): Promise<File> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) throw new WeakPassphraseError();

  // The cache directory, not documents: this file is a hand-off to the share
  // sheet, and an encrypted copy of every document the user owns should not
  // outlive that on the off-chance the share is cancelled.
  const directory = new Directory(Paths.cache, 'exports');
  if (!directory.exists) directory.create({ intermediates: true });

  const file = new File(directory, backupFilename(now));
  // sqlcipher_export appends into whatever is already there, so a leftover file
  // from a cancelled share would produce a backup with every row twice.
  if (file.exists) file.delete();

  const key = sqlLiteral(passphrase);
  const path = toDatabasePath(file.uri);

  await db.execAsync(`ATTACH DATABASE ${sqlLiteral(path)} AS backup KEY ${key}`);

  try {
    await db.execAsync(`SELECT sqlcipher_export('backup')`);
    // Stamped so a restore can refuse a file from a future schema rather than
    // reading columns that do not exist yet.
    await db.execAsync(`PRAGMA backup.user_version = ${BACKUP_SCHEMA_VERSION}`);
  } catch (caught) {
    // A half-written export is worse than none: it is a file the user may well
    // keep, believing their documents are in it. Take it away rather than leave
    // a backup that restores part of a vault.
    await discardExport(file);
    throw caught;
  } finally {
    // DETACH in a finally: leaving the backup attached would keep the file
    // locked and quietly poison every later export in this session.
    await db.execAsync(`DETACH DATABASE backup`);
  }

  return file;
}

/** Removes a temporary export once it has been shared, or once sharing failed. */
export async function discardExport(file: File): Promise<void> {
  try {
    if (file.exists) file.delete();
  } catch {
    // Cache. The OS reclaims it either way.
  }
}

export type ImportResult = {
  documents: number;
  photos: number;
};

/**
 * Restores from a passphrase-encrypted backup, merging into the current vault.
 *
 * Merge, not replace. Someone restoring onto a phone they have already been
 * using should not lose what is on it, so rows are reconciled by `updated_at`
 * and the newer edit wins — the same last-write-wins rule the schema was built
 * around. A backup older than the live row leaves that row alone.
 *
 * Reminders are pointedly NOT copied. A `notification_id` is a handle belonging
 * to the OS on the device that scheduled it; carried to another phone it refers
 * to nothing, and the user would get a vault of documents with no alerts and no
 * indication anything was wrong. They are rebuilt from scratch at the end.
 */
export async function importVault(
  db: SQLiteDatabase,
  fileUri: string,
  passphrase: string
): Promise<ImportResult> {
  const path = toDatabasePath(fileUri);

  try {
    await db.execAsync(
      `ATTACH DATABASE ${sqlLiteral(path)} AS backup KEY ${sqlLiteral(passphrase)}`
    );
  } catch {
    // Some builds derive and reject the key during ATTACH itself rather than on
    // first read, so a bad passphrase can fail here. Both paths must reach the
    // user as the same comprehensible message.
    throw new WrongPassphraseError();
  }

  try {
    // ATTACH succeeds without verifying the key — SQLCipher only derives and
    // tests it on first read. This read IS the passphrase check, and it is the
    // same trick init.ts uses to turn an incomprehensible "file is not a
    // database" into something a person can act on.
    try {
      await db.getFirstAsync(`SELECT count(*) FROM backup.sqlite_master`);
    } catch {
      throw new WrongPassphraseError();
    }

    const version = await db.getFirstAsync<{ user_version: number }>(
      `PRAGMA backup.user_version`
    );
    const found = version?.user_version ?? 0;
    if (found > BACKUP_SCHEMA_VERSION) throw new IncompatibleBackupError(found);

    // Newer-wins on both tables. `excluded` is the incoming backup row; the
    // WHERE on the DO UPDATE is what keeps a stale backup from overwriting an
    // edit made on this phone since the file was written.
    const documents = await db.runAsync(
      `INSERT INTO documents
         (id, user_id, title, kind, issuer, reference, expires_on, issued_on, notes,
          image_path, created_at, updated_at, deleted_at, synced_at)
       SELECT id, user_id, title, kind, issuer, reference, expires_on, issued_on, notes,
              NULL, created_at, updated_at, deleted_at, NULL
         FROM backup.documents
        WHERE true
       ON CONFLICT (id) DO UPDATE SET
         title = excluded.title, kind = excluded.kind, issuer = excluded.issuer,
         reference = excluded.reference, expires_on = excluded.expires_on,
         issued_on = excluded.issued_on, notes = excluded.notes,
         deleted_at = excluded.deleted_at, updated_at = excluded.updated_at,
         synced_at = NULL
       WHERE excluded.updated_at > documents.updated_at`
    );

    const photos = await db.runAsync(
      `INSERT INTO document_images (document_id, data, mime, created_at, updated_at)
       SELECT document_id, data, mime, created_at, updated_at FROM backup.document_images
        WHERE true
       ON CONFLICT (document_id) DO UPDATE SET
         data = excluded.data, mime = excluded.mime, updated_at = excluded.updated_at
       WHERE excluded.updated_at > document_images.updated_at`
    );

    return { documents: documents.changes, photos: photos.changes };
  } finally {
    await db.execAsync(`DETACH DATABASE backup`);
  }
}

/**
 * Rebuilds every reminder after a restore. Separate from `importVault` because
 * it talks to the OS scheduler rather than the database, and because it must
 * run after the backup is detached — not inside a block holding two databases
 * open while it awaits a notification API.
 */
export async function rescheduleAfterImport(
  db: SQLiteDatabase,
  plan: ReminderPlan = DEFAULT_PLAN
): Promise<void> {
  await rescheduleAll(db, plan);
}

/** Documents in the vault right now, for the confirmation copy before a restore. */
export async function countDocuments(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) AS n FROM documents WHERE deleted_at IS NULL`
  );
  return row?.n ?? 0;
}

export type { DocumentRow };
