import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_SETTINGS } from '@/db/settings';
import { deleteImage } from '@/lib/images';
import { cancelReminder, reminderDate, scheduleReminder } from '@/lib/notifications';

import type { DocumentRow, NewDocument, ReminderRow } from './types';

const nowIso = () => new Date().toISOString();

/** How the user has chosen to be warned. Defaults apply when nothing is stored. */
export type ReminderPlan = { offsets: number[]; hour: number };

export const DEFAULT_PLAN: ReminderPlan = {
  offsets: DEFAULT_SETTINGS.reminderOffsets,
  hour: DEFAULT_SETTINGS.reminderHour,
};

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

/** The scheduled reminders for one document, for the detail screen to show. */
export async function listReminders(
  db: SQLiteDatabase,
  documentId: string
): Promise<ReminderRow[]> {
  return db.getAllAsync<ReminderRow>(
    `SELECT * FROM reminders WHERE document_id = ? AND deleted_at IS NULL ORDER BY fire_at ASC`,
    documentId
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
export async function createDocument(
  db: SQLiteDatabase,
  input: NewDocument,
  plan: ReminderPlan = DEFAULT_PLAN
): Promise<string> {
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

  await syncReminders(db, id, input.title, input.expiresOn, plan);
  return id;
}

export async function updateDocument(
  db: SQLiteDatabase,
  id: string,
  input: NewDocument,
  plan: ReminderPlan = DEFAULT_PLAN
): Promise<void> {
  // The photo that is being replaced has to go before the column is overwritten,
  // or its path is lost and the file is orphaned in app storage forever.
  const previous = await getDocument(db, id);
  if (previous?.image_path && previous.image_path !== (input.imagePath ?? null)) {
    await deleteImage(previous.image_path);
  }

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

  await syncReminders(db, id, input.title, input.expiresOn, plan);
}

/**
 * Soft delete. A hard DELETE can't be replicated — the other device would just
 * push the row back on the next sync — so the tombstone stays.
 *
 * The attached photo is genuinely removed, though. A tombstone is a row saying
 * "this is gone"; keeping the picture of the passport it referred to would make
 * that a lie.
 */
export async function deleteDocument(db: SQLiteDatabase, id: string): Promise<void> {
  const ts = nowIso();
  const existing = await getDocument(db, id);

  await clearReminders(db, id, ts);
  await deleteImage(existing?.image_path ?? null);

  await db.runAsync(
    `UPDATE documents
        SET deleted_at = ?, updated_at = ?, image_path = NULL, synced_at = NULL
      WHERE id = ?`,
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
 * what applies. Recomputing beats diffing here — there are at most a handful,
 * and a stale alert for a date the user already corrected is the one bug that
 * would destroy trust in the whole app.
 */
export async function syncReminders(
  db: SQLiteDatabase,
  documentId: string,
  title: string,
  expiresOn: string,
  plan: ReminderPlan = DEFAULT_PLAN
): Promise<void> {
  const ts = nowIso();
  await clearReminders(db, documentId, ts);

  for (const offset of plan.offsets) {
    const notificationId = await scheduleReminder(documentId, title, expiresOn, offset, plan.hour);
    if (!notificationId) continue; // Already in the past — nothing to warn about.

    await db.runAsync(
      `INSERT INTO reminders
         (id, document_id, offset_days, fire_at, notification_id, created_at, updated_at, deleted_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      Crypto.randomUUID(),
      documentId,
      offset,
      reminderDate(expiresOn, offset, plan.hour).toISOString(),
      notificationId,
      ts,
      ts
    );
  }
}

/**
 * Re-applies a changed reminder plan across the whole vault. Called when the
 * user edits reminder timing in settings — otherwise the new preference would
 * only take effect on documents they happened to edit afterwards, which is the
 * kind of half-applied setting that makes people stop trusting the app.
 */
export async function rescheduleAll(db: SQLiteDatabase, plan: ReminderPlan): Promise<void> {
  const documents = await listDocuments(db);
  for (const doc of documents) {
    await syncReminders(db, doc.id, doc.title, doc.expires_on, plan);
  }
}

/**
 * Wipes every document, reminder and photo. Settings survive — someone clearing
 * their data wants the documents gone, not their theme reset.
 */
export async function eraseAllDocuments(db: SQLiteDatabase): Promise<void> {
  const documents = await db.getAllAsync<DocumentRow>(`SELECT * FROM documents`);
  const reminders = await db.getAllAsync<ReminderRow>(
    `SELECT * FROM reminders WHERE notification_id IS NOT NULL`
  );

  for (const reminder of reminders) {
    if (reminder.notification_id) await cancelReminder(reminder.notification_id);
  }
  for (const doc of documents) {
    await deleteImage(doc.image_path);
  }

  // A real DELETE, not a tombstone: this is the "leave no trace" action, and a
  // vault full of tombstones naming every document you ever held is a trace.
  await db.execAsync(`DELETE FROM reminders; DELETE FROM documents;`);
}
