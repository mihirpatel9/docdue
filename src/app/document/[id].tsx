import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { KindTile } from '@/components/kind-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Elevation, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { deleteDocument, getDocument, listReminders } from '@/db/documents';
import { IS_INSECURE_PREVIEW } from '@/db/init';
import { KIND_LABELS, type DocumentRow, type ReminderRow } from '@/db/types';
import { offsetLabel } from '@/db/settings';
import { useTheme } from '@/hooks/use-theme';
import {
  URGENCY_TOKENS,
  daysUntilExpiry,
  expiryLabel,
  formatIsoDate,
  urgencyOf,
} from '@/lib/expiry';
import { successFeedback, tapFeedback } from '@/lib/haptics';

function DetailRow({ icon, label, value }: { icon: 'calendar-blank-outline' | 'office-building-outline' | 'pound' | 'clock-outline'; label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Icon name={icon} size={18} color={theme.textTertiary} style={styles.rowIcon} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.rowValue} selectable>
        {value}
      </ThemedText>
    </View>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.panel,
        Elevation.card,
        { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
      ]}>
      {children}
    </View>
  );
}

export default function DocumentDetailScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Refetches on focus so returning from the edit form shows the new values
  // rather than the ones captured when this screen was first opened.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      Promise.all([getDocument(db, id), listReminders(db, id)]).then(([row, rows]) => {
        if (!active) return;
        setDoc(row);
        setReminders(rows);
        setLoaded(true);
      });

      return () => {
        active = false;
      };
    }, [db, id])
  );

  if (!loaded) return <ThemedView style={styles.screen} />;

  if (!doc) {
    return (
      <ThemedView style={[styles.screen, styles.missing]}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Icon name="file-remove-outline" size={40} color={theme.textTertiary} />
        <ThemedText type="heading">This document is gone</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>
          It was deleted, or the link is out of date.
        </ThemedText>
        <Button label="Back to documents" variant="secondary" onPress={() => router.back()} />
      </ThemedView>
    );
  }

  const daysLeft = daysUntilExpiry(doc.expires_on);
  const urgency = urgencyOf(daysLeft);
  const tokens = URGENCY_TOKENS[urgency];
  const accent = theme[tokens.fg];

  // Only reminders still ahead of us. Listing the 30-day warning that fired last
  // week as though it were pending is worse than showing nothing.
  const upcoming = reminders.filter((reminder) => Date.parse(reminder.fire_at) > Date.now());

  async function confirmDelete() {
    setDeleting(true);
    await deleteDocument(db, id);
    successFeedback();
    setConfirming(false);
    router.back();
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: KIND_LABELS[doc.kind] ?? 'Document' }} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme[tokens.surface] }]}>
          <KindTile kind={doc.kind} size={56} />
          <View style={styles.heroBody}>
            <ThemedText type="label" themeColor="textSecondary">
              {KIND_LABELS[doc.kind] ?? 'Document'}
            </ThemedText>
            <ThemedText type="subtitle">{doc.title}</ThemedText>
            <View style={styles.heroStatus}>
              <Icon
                name={urgency === 'ok' ? 'check-circle-outline' : 'alert-circle-outline'}
                size={16}
                color={accent}
              />
              <ThemedText type="smallBold" style={{ color: accent }}>
                {expiryLabel(daysLeft)}
              </ThemedText>
            </View>
          </View>
        </View>

        {doc.image_path ? (
          <Panel>
            <Image
              source={{ uri: doc.image_path }}
              style={styles.photo}
              contentFit="cover"
              transition={180}
            />
          </Panel>
        ) : null}

        <Panel>
          <DetailRow
            icon="calendar-blank-outline"
            label="Expires"
            value={formatIsoDate(doc.expires_on)}
          />
          {doc.issued_on ? (
            <DetailRow
              icon="calendar-blank-outline"
              label="Issued"
              value={formatIsoDate(doc.issued_on)}
            />
          ) : null}
          {doc.issuer ? (
            <DetailRow icon="office-building-outline" label="Issued by" value={doc.issuer} />
          ) : null}
          {doc.reference ? (
            <DetailRow icon="pound" label="Reference" value={doc.reference} />
          ) : null}
        </Panel>

        {doc.notes ? (
          <Panel>
            <ThemedText type="label" themeColor="textSecondary">
              Notes
            </ThemedText>
            <ThemedText type="default" style={styles.notes} selectable>
              {doc.notes}
            </ThemedText>
          </Panel>
        ) : null}

        <Panel>
          <ThemedText type="label" themeColor="textSecondary">
            Reminders
          </ThemedText>
          {upcoming.length === 0 ? (
            <ThemedText type="small" themeColor="textTertiary">
              {IS_INSECURE_PREVIEW
                ? 'Reminders are a native feature and do not run in the browser preview.'
                : daysLeft < 0
                  ? 'None — this document has already expired.'
                  : 'None scheduled. Check reminder timing in Settings.'}
            </ThemedText>
          ) : (
            upcoming.map((reminder) => (
              <View key={reminder.id} style={styles.reminder}>
                <Icon name="bell-outline" size={16} color={theme.tint} />
                <ThemedText type="small" style={styles.rowValue}>
                  {offsetLabel(reminder.offset_days)}
                </ThemedText>
                <ThemedText type="caption" themeColor="textTertiary">
                  {formatIsoDate(reminder.fire_at.slice(0, 10))}
                </ThemedText>
              </View>
            ))
          )}
        </Panel>

        <View style={styles.actions}>
          <Button
            label="Edit document"
            icon="pencil-outline"
            onPress={() => {
              tapFeedback();
              router.push({ pathname: '/form', params: { id: doc.id } });
            }}
          />
          <Button
            label="Delete"
            icon="trash-can-outline"
            variant="destructive"
            onPress={() => {
              tapFeedback();
              setConfirming(true);
            }}
          />
        </View>

        <ThemedText type="caption" themeColor="textTertiary" style={styles.centred}>
          Added {formatIsoDate(doc.created_at.slice(0, 10))}
        </ThemedText>
      </ScrollView>

      {/*
        A custom sheet rather than Alert.alert: the native alert is a no-op on
        web, which would leave the preview with a Delete button that silently
        does nothing.
      */}
      <Modal
        visible={confirming}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirming(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.overlay }]}
          onPress={() => setConfirming(false)}>
          <Pressable
            style={[styles.dialog, { backgroundColor: theme.background }]}
            onPress={(event) => event.stopPropagation()}>
            <ThemedText type="heading">Delete this document?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {doc.title} and its reminders
              {doc.image_path ? ' and photo' : ''} will be removed from this device. This cannot be
              undone.
            </ThemedText>
            <View style={styles.dialogActions}>
              <Button
                label="Keep"
                variant="secondary"
                style={styles.dialogAction}
                onPress={() => setConfirming(false)}
              />
              <Button
                label="Delete"
                variant="destructive"
                loading={deleting}
                style={styles.dialogAction}
                onPress={confirmDelete}
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
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  hero: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    alignItems: 'center',
  },
  heroBody: { flex: 1, gap: Spacing.half },
  heroStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2, marginTop: Spacing.one },
  panel: {
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  photo: { width: '100%', aspectRatio: 1.6, borderRadius: Radius.small },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowIcon: { width: 20 },
  rowLabel: { width: 88 },
  rowValue: { flex: 1, fontWeight: '600' },
  notes: { lineHeight: 24 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  missing: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  centred: { textAlign: 'center' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: { width: '100%', maxWidth: 380, borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two },
  dialogActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  dialogAction: { flex: 1 },
});
