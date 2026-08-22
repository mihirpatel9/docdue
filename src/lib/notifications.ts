import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** How far ahead we warn. Chosen so there is still time to actually renew. */
export const REMINDER_OFFSETS = [30, 7, 0] as const;

const ANDROID_CHANNEL = 'expiry-reminders';
/** Local hour to fire at. Morning, so it lands in the day's first phone check. */
const REMINDER_HOUR = 9;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationSetup(): Promise<boolean> {
  // Web notifications cannot be scheduled months into the future — they need
  // the page open or a service worker. The reminders are a native feature.
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Expiry reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return asked.granted;
}

/**
 * The moment a reminder should fire: `offsetDays` before the expiry date, at
 * 09:00 in the phone's own timezone. Built with local Date parts rather than
 * from an ISO string so it lands at 9am where the user actually is.
 */
export function reminderDate(expiresOn: string, offsetDays: number): Date {
  const [year, month, day] = expiresOn.split('-').map(Number);
  return new Date(year, month - 1, day - offsetDays, REMINDER_HOUR, 0, 0, 0);
}

function reminderBody(title: string, offsetDays: number): string {
  if (offsetDays === 0) return `${title} expires today.`;
  if (offsetDays === 1) return `${title} expires tomorrow.`;
  return `${title} expires in ${offsetDays} days.`;
}

/**
 * Schedules one reminder and returns the OS handle, or null if the moment has
 * already passed. Adding a document that expires next week must not silently
 * fail just because its 30-day reminder is in the past — the caller keeps the
 * ones that did schedule.
 */
export async function scheduleReminder(
  documentId: string,
  title: string,
  expiresOn: string,
  offsetDays: number,
  now: Date = new Date()
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const fireAt = reminderDate(expiresOn, offsetDays);
  if (fireAt.getTime() <= now.getTime()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: offsetDays === 0 ? 'Expires today' : 'Renewal coming up',
      body: reminderBody(title, offsetDays),
      data: { documentId },
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : null),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
}

/** Best-effort cancel: a handle the OS has already fired or forgotten is fine. */
export async function cancelReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already fired, already cancelled, or lost to a reinstall. Nothing to do.
  }
}
