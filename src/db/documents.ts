import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { REMINDER_OFFSETS, cancelReminder, reminderDate, scheduleReminder } from '@/lib/notifications';

import type { DocumentRow, NewDocument, ReminderRow } from './types';

const nowIso = () => new Date().toISOString();

/**
 * Documents that still count, soonest expiry first — the only order this app's
 * home screen ever wants.
 */
export async function listDocuments(db: SQLiteDatabase): Promise<DocumentRow[]> {
  return db.getAllAsync<DocumentRow>(
    `SELECT * FROM documents WHERE deleted_at IS NULL ORDER BY expires_on ASC`
  );
}

export async function getDocument(db: SQLiteDatabase, id: string): Promise<DocumentRow | null> {
  return db.getFirstAsync<DocumentRow>(
    `SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL`,
    id
  );
}

/**
 * Creates the document and its reminders in one transaction, then schedules
 * with the OS.
 *
 * Order matters: the DB write commits first, then notifications are scheduled.
 * If scheduling fails the user still has their document and we can reschedule
 * later; the reverse would leave orphaned alerts firing for a document that
 * was never saved.
 */
export async function createDocument(db: SQLiteDatabase, input: NewDocument): Promise<string> {
  const id = Crypto.randomUUID();
  const ts = nowIso();

  await db.runAsync(
    `INSERT INTO documents
       (id, user_id, title, kind, issuer, reference, expires_on, issued_on, notes,
        image_path, created_at, updated_at, deleted_at, synced_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    id,
    input.title,
    input.kind,
    input.issuer ?? null,
    input.reference ?? null,
    input.expiresOn,
    input.issuedOn ?? null,
    input.notes ?? null,
    input.imagePath ?? null,
    ts,
    ts
  );

  await syncReminders(db, id, input.title, input.expiresOn);
  return id;
}

export async function updateDocument(
  db: SQLiteDatabase,
  id: string,
  input: NewDocument
): Promise<void> {
  await db.runAsync(
    `UPDATE documents
        SET title = ?, kind = ?, issuer = ?, reference = ?, expires_on = ?,
            issued_on = ?, notes = ?, image_path = ?, updated_at = ?, synced_at = NULL
      WHERE id = ?`,
    input.title,
    input.kind,
    input.issuer ?? null,
    input.reference ?? null,
    input.expiresOn,
    input.issuedOn ?? null,
    input.notes ?? null,
    input.imagePath ?? null,
    nowIso(),
    id
  );

  await syncReminders(db, id, input.title, input.expiresOn);
}

/**
 * Soft delete. A hard DELETE can't be replicated — the other device would just
 * push the row back on the next sync — so the tombstone stays.
 */
export async function deleteDocument(db: SQLiteDatabase, id: string): Promise<void> {
  const ts = nowIso();
  await clearReminders(db, id, ts);
  await db.runAsync(
    `UPDATE documents SET deleted_at = ?, updated_at = ?, synced_at = NULL WHERE id = ?`,
    ts,
    ts,
    id
  );
}

async function clearReminders(db: SQLiteDatabase, documentId: string, ts: string): Promise<void> {
  const existing = await db.getAllAsync<ReminderRow>(
    `SELECT * FROM reminders WHERE document_id = ? AND deleted_at IS NULL`,
    documentId
  );

  for (const reminder of existing) {
    if (reminder.notification_id) await cancelReminder(reminder.notification_id);
  }

  await db.runAsync(
    `UPDATE reminders SET deleted_at = ?, updated_at = ?, synced_at = NULL
      WHERE document_id = ? AND deleted_at IS NULL`,
    ts,
    ts,
    documentId
  );
}

/**
 * Rebuilds a document's reminders from scratch: cancel what exists, schedule
 * what applies. Recomputing beats diffing here — there are at most three, and
 * a stale alert for a date the user already corrected is the one bug that
 * would destroy trust in the whole app.
 */
export async function syncReminders(
  db: SQLiteDatabase,
  documentId: string,
  title: string,
  expiresOn: string
): Promise<void> {
  const ts = nowIso();
  await clearReminders(db, documentId, ts);

  for (const offset of REMINDER_OFFSETS) {
    const notificationId = await scheduleReminder(documentId, title, expiresOn, offset);
    if (!notificationId) continue; // Already in the past — nothing to warn about.

    await db.runAsync(
      `INSERT INTO reminders
         (id, document_id, offset_days, fire_at, notification_id, created_at, updated_at, deleted_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      Crypto.randomUUID(),
      documentId,
      offset,
      reminderDate(expiresOn, offset).toISOString(),
      notificationId,
      ts,
      ts
    );
  }
}
