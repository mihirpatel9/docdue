import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackupPanel } from '@/components/backup-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon, type IconName } from '@/components/ui/icon';
import { Elevation, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { eraseAllDocuments, rescheduleAll } from '@/db/documents';
import { IS_INSECURE_PREVIEW } from '@/db/init';
import { AVAILABLE_OFFSETS, offsetLabel, type Settings } from '@/db/settings';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { selectionFeedback, successFeedback, tapFeedback } from '@/lib/haptics';

const THEME_MODES: { mode: Settings['themeMode']; label: string; icon: IconName }[] = [
  { mode: 'system', label: 'System', icon: 'cellphone-cog' },
  { mode: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { mode: 'dark', label: 'Dark', icon: 'weather-night' },
];

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textSecondary">
        {title}
      </ThemedText>
      <View
        style={[
          styles.panel,
          Elevation.card,
          { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
        ]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  title,
  description,
  children,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {icon ? <Icon name={icon} size={20} color={theme.textSecondary} style={styles.rowIcon} /> : null}
      <View style={styles.rowBody}>
        <ThemedText type="default" style={styles.rowTitle}>
          {title}
        </ThemedText>
        {description ? (
          <ThemedText type="caption" themeColor="textTertiary">
            {description}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();

  const [rescheduling, setRescheduling] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [erased, setErased] = useState(false);

  /**
   * A reminder preference that only applied to documents added afterwards would
   * be a setting that half works, so every change re-plans the whole vault.
   */
  async function applyReminderChange(next: Partial<Pick<Settings, 'reminderOffsets' | 'reminderHour'>>) {
    const offsets = next.reminderOffsets ?? settings.reminderOffsets;
    const hour = next.reminderHour ?? settings.reminderHour;

    setRescheduling(true);
    if (next.reminderOffsets) await update('reminderOffsets', offsets);
    if (next.reminderHour !== undefined) await update('reminderHour', hour);
    await rescheduleAll(db, { offsets, hour });
    setRescheduling(false);
  }

  function toggleOffset(days: number) {
    selectionFeedback();
    const selected = settings.reminderOffsets.includes(days);
    const offsets = selected
      ? settings.reminderOffsets.filter((value) => value !== days)
      : [...settings.reminderOffsets, days].sort((a, b) => b - a);
    applyReminderChange({ reminderOffsets: offsets });
  }

  function shiftHour(delta: number) {
    // Clamped rather than wrapped: nobody means to set a reminder for 3am by
    // holding down the minus button.
    const hour = Math.min(21, Math.max(6, settings.reminderHour + delta));
    if (hour === settings.reminderHour) return;
    selectionFeedback();
    applyReminderChange({ reminderHour: hour });
  }

  async function erase() {
    setErasing(true);
    await eraseAllDocuments(db);
    successFeedback();
    setErasing(false);
    setConfirmErase(false);
    setErased(true);
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <ThemedText type="title">Settings</ThemedText>

        <Section title="Appearance">
          <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
            {THEME_MODES.map((option) => {
              const selected = settings.themeMode === option.mode;
              return (
                <Pressable
                  key={option.mode}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    selectionFeedback();
                    update('themeMode', option.mode);
                  }}
                  style={[styles.segment, selected && { backgroundColor: theme.backgroundElevated }]}>
                  <Icon
                    name={option.icon}
                    size={18}
                    color={selected ? theme.tint : theme.textSecondary}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: selected ? theme.text : theme.textSecondary,
                      fontWeight: selected ? '700' : '500',
                    }}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Reminders">
          <View style={styles.block}>
            <ThemedText type="default" style={styles.rowTitle}>
              Warn me
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              Pick every point you want a notification before a document expires.
            </ThemedText>
            <View style={styles.chips}>
              {AVAILABLE_OFFSETS.map((days) => (
                <Chip
                  key={days}
                  label={offsetLabel(days)}
                  selected={settings.reminderOffsets.includes(days)}
                  onPress={() => toggleOffset(days)}
                />
              ))}
            </View>
            {settings.reminderOffsets.length === 0 ? (
              <ThemedText type="caption" style={{ color: theme.warning }}>
                No reminders selected — this app will not warn you about anything.
              </ThemedText>
            ) : null}
          </View>

          <View style={[styles.separator, { backgroundColor: theme.border }]} />

          <Row icon="clock-outline" title="Time of day" description="When reminders arrive">
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Earlier"
                onPress={() => shiftHour(-1)}
                style={[styles.stepperButton, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="minus" size={18} color={theme.text} />
              </Pressable>
              <ThemedText type="small" style={styles.stepperValue}>
                {formatHour(settings.reminderHour)}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Later"
                onPress={() => shiftHour(1)}
                style={[styles.stepperButton, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="plus" size={18} color={theme.text} />
              </Pressable>
            </View>
          </Row>

          {rescheduling ? (
            <ThemedText type="caption" themeColor="textTertiary">
              Rescheduling reminders…
            </ThemedText>
          ) : null}

          {IS_INSECURE_PREVIEW ? (
            <ThemedText type="caption" style={{ color: theme.warning }}>
              Reminders do not run in the browser preview. They are a native feature.
            </ThemedText>
          ) : null}
        </Section>

        <Section title="List">
          <Row
            icon="eye-off-outline"
            title="Show expired documents"
            description="Turn off to hide anything that has already lapsed">
            <Switch
              value={settings.showExpired}
              onValueChange={(value) => {
                selectionFeedback();
                update('showExpired', value);
              }}
              trackColor={{ true: theme.tint, false: theme.backgroundSelected }}
              thumbColor={Platform.OS === 'android' ? theme.backgroundElevated : undefined}
            />
          </Row>
        </Section>

        <Section title="Security">
          <Row
            icon="shield-lock-outline"
            title={IS_INSECURE_PREVIEW ? 'Not encrypted in the browser' : 'Encrypted on this device'}
            description={
              IS_INSECURE_PREVIEW
                ? 'The browser has no Keychain and no SQLCipher. Use test data only.'
                : 'AES-256 via SQLCipher. The key lives in the device keystore and never leaves it.'
            }
          />
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
          <Row
            icon="lock-outline"
            title="Locks automatically"
            description="Face ID or your passcode is required after 15 seconds in the background."
          />
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
          <Row
            icon="cloud-off-outline"
            title="Nothing is uploaded"
            description="No account, no server, no analytics. Documents stay on this device."
          />
        </Section>

        <Section title="Backup">
          <BackupPanel
            plan={{ offsets: settings.reminderOffsets, hour: settings.reminderHour }}
            onImported={() => setErased(false)}
          />
        </Section>

        <Section title="Data">
          {erased ? (
            <ThemedText type="small" style={{ color: theme.success }}>
              All documents erased.
            </ThemedText>
          ) : (
            <>
              <Row
                icon="delete-forever-outline"
                title="Erase all documents"
                description="Permanently removes every document, reminder and photo."
              />
              <Button
                label="Erase everything"
                variant="destructive"
                icon="trash-can-outline"
                onPress={() => {
                  tapFeedback();
                  setConfirmErase(true);
                }}
              />
            </>
          )}
        </Section>

        <View style={styles.about}>
          <ThemedText type="caption" themeColor="textTertiary" style={styles.centred}>
            {Constants.expoConfig?.name ?? 'DocDue'} {Constants.expoConfig?.version ?? ''}
          </ThemedText>
        </View>
      </ScrollView>

      <Modal
        visible={confirmErase}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmErase(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.overlay }]}
          onPress={() => setConfirmErase(false)}>
          <Pressable
            style={[styles.dialog, { backgroundColor: theme.background }]}
            onPress={(event) => event.stopPropagation()}>
            <ThemedText type="heading">Erase everything?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Every document, reminder and photo is deleted from this device. Nothing here can undo
              it — only a backup file you made earlier can.
            </ThemedText>
            <View style={styles.dialogActions}>
              <Button
                label="Cancel"
                variant="secondary"
                style={styles.dialogAction}
                onPress={() => setConfirmErase(false)}
              />
              <Button
                label="Erase"
                variant="destructive"
                loading={erasing}
                style={styles.dialogAction}
                onPress={erase}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: { gap: Spacing.two },
  panel: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  block: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  rowIcon: { width: 22 },
  rowBody: { flex: 1, gap: 1 },
  rowTitle: { fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  segmented: { flexDirection: 'row', borderRadius: Radius.medium, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.small + 1,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepperButton: { width: 32, height: 32, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { minWidth: 66, textAlign: 'center', fontWeight: '700' },
  about: { paddingTop: Spacing.two },
  centred: { textAlign: 'center' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: { width: '100%', maxWidth: 380, borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two },
  dialogActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  dialogAction: { flex: 1 },
});
