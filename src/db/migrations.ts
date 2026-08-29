import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Bump this and add a matching `if (version === N)` block below. Never edit an
 * existing block — someone's phone is already at that version and will never
 * replay it.
 */
const DATABASE_VERSION = 3;

/**
 * Schema notes that are load-bearing, not decoration:
 *
 * - `id` is a device-generated UUID, not an autoincrement integer. Two phones
 *   offline at the same time must be able to create rows that merge cleanly
 *   when sync arrives. Integers collide; UUIDs don't.
 * - `user_id` is null until the day accounts exist. Adding the column now means
 *   sync is a feature, not a migration of everyone's data.
 * - `updated_at` / `deleted_at` / `synced_at` are the sync triad: last write
 *   wins by `updated_at`, deletes are tombstones (a hard DELETE can't be
 *   replicated), and `synced_at IS NULL` means "this row is dirty, push it".
 * - `expires_on` is an ISO calendar date (yyyy-mm-dd), NOT a timestamp. A
 *   passport expires on a date, not at an instant. Storing an instant means a
 *   document silently expires a day early for anyone west of UTC.
 */
const V1 = `
CREATE TABLE documents (
  id            TEXT PRIMARY KEY NOT NULL,
  user_id       TEXT,
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL,
  issuer        TEXT,
  reference     TEXT,
  expires_on    TEXT NOT NULL,
  issued_on     TEXT,
  notes         TEXT,
  image_path    TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  synced_at     TEXT
);

CREATE INDEX documents_by_expiry ON documents (expires_on) WHERE deleted_at IS NULL;
CREATE INDEX documents_dirty ON documents (synced_at) WHERE synced_at IS NULL;

CREATE TABLE reminders (
  id              TEXT PRIMARY KEY NOT NULL,
  document_id     TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  offset_days     INTEGER NOT NULL,
  fire_at         TEXT NOT NULL,
  notification_id TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT,
  synced_at       TEXT
);

CREATE INDEX reminders_by_document ON reminders (document_id);
CREATE UNIQUE INDEX reminders_unique_offset ON reminders (document_id, offset_days) WHERE deleted_at IS NULL;
`;

/**
 * Preferences live in the vault rather than in AsyncStorage so they inherit the
 * same encryption as the documents. Which reminders a person has switched on is
 * itself a small disclosure — "warns me about a visa" says something.
 *
 * A key/value table, not a one-row table with a column per setting: adding a
 * preference must not be a schema migration everyone has to replay.
 */
const V2 = `
CREATE TABLE settings (
  key        TEXT PRIMARY KEY NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

/**
 * Photos move INTO the vault.
 *
 * Until now a document's picture lived as a loose file in the app container and
 * only the database was encrypted — so a rooted phone or a filesystem dump gave
 * up every passport photo in the clear while the text beside it stayed sealed.
 * That is the wrong way round: the photo IS the sensitive part.
 *
 * Stored as base64 TEXT rather than a BLOB. SQLCipher encrypts both identically,
 * so this costs 33% in size and buys two things: `expo-file-system` hands us
 * base64 directly, and the value renders as a data URI with no byte conversion
 * in between. For a handful of document photos the size is irrelevant and the
 * removed encoding step is a removed class of bug.
 *
 * A separate table, not a column on `documents`: the home screen lists every
 * document on every render, and a photo column would drag megabytes of base64
 * through a query that only ever needed the title and a date.
 */
const V3 = `
CREATE TABLE document_images (
  document_id TEXT PRIMARY KEY NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  mime        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
`;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // These run on EVERY open, before the version check. Foreign keys are OFF by
  // default in SQLite and are a per-connection setting, not a stored one — put
  // this behind the "already migrated" early return and the reminders cascade
  // silently stops working on the second launch. WAL is persistent but is
  // cheap to re-assert and belongs with it.
  await db.execAsync(`PRAGMA journal_mode = 'wal'; PRAGMA foreign_keys = ON;`);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(V1);
    version = 1;
  }

  if (version === 1) {
    await db.execAsync(V2);
    version = 2;
  }

  if (version === 2) {
    await db.execAsync(V3);
    version = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
