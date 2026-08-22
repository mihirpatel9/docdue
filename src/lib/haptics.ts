import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics are decoration, never a signal on their own. Every call is
 * fire-and-forget and swallows its own failure: a phone with the taptic engine
 * disabled, or a web browser, must not turn a save into an error.
 */
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

export function tapFeedback() {
  if (supported) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function selectionFeedback() {
  if (supported) Haptics.selectionAsync().catch(() => {});
}

export function successFeedback() {
  if (supported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warningFeedback() {
  if (supported) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
