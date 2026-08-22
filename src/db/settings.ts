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
};

export const DEFAULT_SETTINGS: Settings = {
  reminderOffsets: [30, 7, 0],
  reminderHour: 9,
  themeMode: 'system',
  showExpired: true,
};

/** Every offset the UI offers, in the order the settings screen lists them. */
export const AVAILABLE_OFFSETS = [90, 60, 30, 14, 7, 1, 0] as const;

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
