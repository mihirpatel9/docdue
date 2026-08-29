import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Everything the user can change about how the app behaves. Kept small on
 * purpose — a settings screen is where features go to hide from a decision.
 */
export type Settings = {
  /** Days before expiry to warn. Sorted descending; 0 means "on the day". */
  reminderOffsets: number[];
  /** Local hour reminders fire at, 0–23. */
  reminderHour: number;
  themeMode: 'system' | 'light' | 'dark';
  /** Keep documents in the list after they lapse, or tuck them away. */
  showExpired: boolean;
  /**
   * ISO timestamp of the last successful export, or null if there has never
   * been one.
   *
   * This is the one piece of state that answers "would I lose everything if I
   * dropped my phone right now" — the vault key is `THIS_DEVICE_ONLY`, so an
   * export file is the ONLY thing that survives the device. Recorded so the app
   * can say so before it matters rather than after.
   */
  lastBackupAt: string | null;
  /**
   * Whether the user has waved away the "make a backup" prompt. Dismissing it
   * hides the banner but does not stop Settings showing the backup age — a
   * prompt you can silence forever is a prompt that fails the one person who
   * needed it.
   */
  backupPromptDismissed: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  reminderOffsets: [30, 7, 0],
  reminderHour: 9,
  themeMode: 'system',
  showExpired: true,
  lastBackupAt: null,
  backupPromptDismissed: false,
};

/** Every offset the UI offers, in the order the settings screen lists them. */
export const AVAILABLE_OFFSETS = [90, 60, 30, 14, 7, 1, 0] as const;

/** Past this, a backup is old enough to be worth mentioning again. */
export const BACKUP_STALE_AFTER_DAYS = 90;

export function backupAgeInDays(lastBackupAt: string | null, now: Date = new Date()): number | null {
  if (!lastBackupAt) return null;
  const then = Date.parse(lastBackupAt);
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

/** Plain words for how long ago the last backup was. */
export function backupAgeLabel(lastBackupAt: string | null, now: Date = new Date()): string {
  const days = backupAgeInDays(lastBackupAt, now);
  if (days === null) return 'Never backed up';
  if (days <= 0) return 'Backed up today';
  if (days === 1) return 'Backed up yesterday';
  if (days < 30) return `Backed up ${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'Backed up a month ago' : `Backed up ${months} months ago`;
}

export function offsetLabel(days: number): string {
  if (days === 0) return 'On the day';
  if (days === 1) return '1 day before';
  return `${days} days before`;
}

/**
 * Reads settings, falling back to the default for anything missing or corrupt.
 * A malformed row must degrade to the default rather than take down the app —
 * the alternative is a preference screen that can permanently brick launch.
 */
export async function loadSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings`
  );

  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.value);
      switch (row.key) {
        case 'reminderOffsets':
          if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
            settings.reminderOffsets = [...new Set(parsed as number[])].sort((a, b) => b - a);
          }
          break;
        case 'reminderHour':
          if (typeof parsed === 'number' && parsed >= 0 && parsed <= 23) {
            settings.reminderHour = Math.floor(parsed);
          }
          break;
        case 'themeMode':
          if (parsed === 'system' || parsed === 'light' || parsed === 'dark') {
            settings.themeMode = parsed;
          }
          break;
        case 'showExpired':
          if (typeof parsed === 'boolean') settings.showExpired = parsed;
          break;
        case 'lastBackupAt':
          // Must parse as a real date. A corrupt value here would otherwise
          // render as "Last backup: Invalid Date" and quietly reassure someone
          // who has no backup at all.
          if (typeof parsed === 'string' && !Number.isNaN(Date.parse(parsed))) {
            settings.lastBackupAt = parsed;
          }
          break;
        case 'backupPromptDismissed':
          if (typeof parsed === 'boolean') settings.backupPromptDismissed = parsed;
          break;
      }
    } catch {
      // Unparseable value: the default already in place is the right answer.
    }
  }

  return settings;
}

export async function saveSetting<K extends keyof Settings>(
  db: SQLiteDatabase,
  key: K,
  value: Settings[K]
): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    new Date().toISOString()
  );
}
