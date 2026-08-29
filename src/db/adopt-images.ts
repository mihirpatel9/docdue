import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { mimeForUri } from '@/lib/images';

import type { DocumentRow } from './types';

/**
 * Moves photos left on disk by an older install into the encrypted vault.
 *
 * This is the data half of migration V3. It cannot live in `migrations.ts`
 * because that file speaks only SQL and this has to read the filesystem.
 *
 * Runs on every open rather than once behind a flag. The work is a single
 * indexed query that returns nothing on all but the first launch after
 * upgrading, and "runs until it has actually finished" is a much safer property
 * than "ran once and we hope it completed" — the app can be killed halfway
 * through a folder of photos and simply picks up the remainder next time.
 *
 * Each photo is committed to the database BEFORE its file is deleted, so a
 * crash in the middle costs a duplicate copy of a photo, never the only copy.
 */
export async function adoptLooseImages(db: SQLiteDatabase): Promise<number> {
  // Web never wrote these files — `persistImage` returned the transient URI
  // unchanged there — so there is nothing on disk to adopt.
  if (Platform.OS === 'web') return 0;

  const pending = await db.getAllAsync<Pick<DocumentRow, 'id' | 'image_path'>>(
    `SELECT id, image_path FROM documents WHERE image_path IS NOT NULL`
  );
  if (pending.length === 0) return 0;

  let adopted = 0;

  for (const row of pending) {
    if (!row.image_path) continue;

    try {
      const file = new File(row.image_path);

      if (file.exists) {
        const data = await file.base64();
        const ts = new Date().toISOString();

        // A document that somehow already has a vault photo keeps it. Replacing
        // it with the loose file would undo an edit the user made after the
        // upgrade.
        await db.runAsync(
          `INSERT INTO document_images (document_id, data, mime, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (document_id) DO NOTHING`,
          row.id,
          data,
          mimeForUri(row.image_path),
          ts,
          ts
        );
        adopted += 1;
      }

      // Clearing the column is what takes this row out of `pending`, and it
      // happens whether or not the file was there. A path pointing at a photo
      // the OS already reclaimed is not a task to retry forever.
      await db.runAsync(`UPDATE documents SET image_path = NULL WHERE id = ?`, row.id);

      if (file.exists) file.delete();
    } catch {
      // Leave image_path set. The row stays pending and the next launch tries
      // again — better than dropping the reference and orphaning the photo.
    }
  }

  return adopted;
}
