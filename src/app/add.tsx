import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { createDocument } from '@/db/documents';
import { DOCUMENT_KINDS, KIND_LABELS, type DocumentKind } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { daysUntilExpiry } from '@/lib/expiry';

/** Accepts yyyy-mm-dd and confirms the calendar actually contains that day. */
function parseExpiry(input: string): { ok: true; iso: string } | { ok: false; error: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) return { ok: false, error: 'Use the format YYYY-MM-DD, for example 2027-04-15.' };

  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));

  // Round-tripping catches 2026-02-31, which Date would happily roll to March.
  const validCalendarDay =
    date.getFullYear() === Number(y) &&
    date.getMonth() === Number(m) - 1 &&
    date.getDate() === Number(d);

  if (!validCalendarDay) return { ok: false, error: 'That date does not exist.' };
  return { ok: true, iso: `${y}-${m}-${d}` };
}

export default function AddDocumentScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<DocumentKind>('drivers_license');
  const [expiresOn, setExpiresOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) {
      setError('Give it a name so you recognise it in the list.');
      return;
    }

    const parsed = parseExpiry(expiresOn);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    // Past dates are allowed on purpose — people add the licence they already
    // let lapse. It just sorts to the top in red with no reminders to schedule.
    setSaving(true);
    setError(null);
    try {
      await createDocument(db, { title: title.trim(), kind, expiresOn: parsed.iso });
      router.back();
    } catch {
      setError('Could not save that. Try again.');
      setSaving(false);
    }
  }

  const parsedPreview = parseExpiry(expiresOn);
  const alreadyExpired = parsedPreview.ok && daysUntilExpiry(parsedPreview.iso) < 0;

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            What is it?
          </ThemedText>
          <TextInput
            style={inputStyle}
            value={title}
            onChangeText={setTitle}
            placeholder="My driver's licence"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="sentences"
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Type
          </ThemedText>
          <View style={styles.chips}>
            {DOCUMENT_KINDS.map((option) => {
              const selected = option === kind;
              return (
                <Pressable
                  key={option}
                  onPress={() => setKind(option)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                    },
                  ]}>
                  <ThemedText type="small">{KIND_LABELS[option]}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Expires on
          </ThemedText>
          <TextInput
            style={inputStyle}
            value={expiresOn}
            onChangeText={setExpiresOn}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
          />
          {alreadyExpired ? (
            <ThemedText type="small" style={styles.warning}>
              That date has passed. It will be saved and flagged as expired.
            </ThemedText>
          ) : null}
        </View>

        {error ? (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={save}
          disabled={saving}
          style={[styles.save, { backgroundColor: theme.text, opacity: saving ? 0.5 : 1 }]}>
          <ThemedText type="default" style={{ color: theme.background, fontWeight: '600' }}>
            {saving ? 'Saving…' : 'Save document'}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four },
  field: { gap: Spacing.two },
  input: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  save: { borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center' },
  error: { color: '#DC2626' },
  warning: { color: '#CA8A04' },
});
