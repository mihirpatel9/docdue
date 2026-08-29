import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { IS_INSECURE_PREVIEW } from '@/db/init';
import { BACKUP_STALE_AFTER_DAYS, backupAgeInDays } from '@/db/settings';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

/**
 * Tells someone their documents exist on this phone and nowhere else.
 *
 * This banner is the fix for the app's one unrecoverable failure: the vault key
 * is `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, so it is excluded from iCloud Keychain
 * and from device backups. A user who transfers to a new phone the normal way
 * gets the database file restored and the key not — an unreadable copy, and no
 * way back. An export file is the only thing that survives the device.
 *
 * Every part of that is invisible until the moment it costs someone their
 * passport. Burying the remedy in Settings and waiting for people to go looking
 * for a feature they do not know exists is not a design; it is a hope.
 *
 * Shown only once there is something to lose, and dismissible — but dismissal
 * only hides the banner. Settings still reports the backup age, because a
 * warning that can be silenced forever fails precisely the person who needed it.
 */
export function BackupPrompt() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();

  // The browser preview has no encryption to protect and no share sheet to send
  // a file to, so the warning would be advice the user cannot act on.
  if (IS_INSECURE_PREVIEW) return null;

  const age = backupAgeInDays(settings.lastBackupAt);
  const never = age === null;
  const stale = age !== null && age >= BACKUP_STALE_AFTER_DAYS;

  // A stale backup re-surfaces even after dismissal: the user acted on the
  // prompt once, and this is new information rather than the same nag.
  if (!never && !stale) return null;
  if (never && settings.backupPromptDismissed) return null;

  const tone = never ? theme.warning : theme.textSecondary;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: theme.backgroundElevated, borderColor: never ? theme.warning : theme.border },
      ]}>
      <Icon name="shield-alert-outline" size={22} color={tone} style={styles.icon} />

      <View style={styles.body}>
        <ThemedText type="smallBold" style={{ color: tone }}>
          {never ? 'These documents exist only on this phone' : 'Your backup is out of date'}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {never
            ? 'Transferring to a new phone will not bring them across — only a backup file will. It takes a moment.'
            : `Last backed up ${Math.floor((age ?? 0) / 30)} months ago. Anything added since is on this phone alone.`}
        </ThemedText>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tapFeedback();
              router.push('/(tabs)/settings');
            }}>
            <ThemedText type="smallBold" style={{ color: theme.tint }}>
              Back up now
            </ThemedText>
          </Pressable>

          {never ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                tapFeedback();
                update('backupPromptDismissed', true);
              }}>
              <ThemedText type="small" themeColor="textTertiary">
                Not now
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: 1,
  },
  icon: { marginTop: 2 },
  body: { flex: 1, gap: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.two },
});
