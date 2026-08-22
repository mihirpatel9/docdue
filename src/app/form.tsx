import * as Crypto from 'expo-crypto';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { PhotoField } from '@/components/photo-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { createDocument, getDocument, updateDocument } from '@/db/documents';
import { DOCUMENT_KINDS, KIND_LABELS, type DocumentKind } from '@/db/types';
import { useSettings } from '@/hooks/use-settings';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { successFeedback, warningFeedback } from '@/lib/haptics';
import { persistImage } from '@/lib/images';
import { kindStyle } from '@/lib/kinds';

/**
 * One screen for adding and for editing.
 *
 * Two near-identical forms is how the edit path ends up missing the field that
 * was added to the add path last month, so the difference is a single `id`
 * search param and nothing else.
 */
export default function DocumentFormScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const { settings } = useSettings();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<DocumentKind>('drivers_license');
  const [expiresOn, setExpiresOn] = useState<string | null>(null);
  const [issuedOn, setIssuedOn] = useState<string | null>(null);
  const [issuer, setIssuer] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  /** The photo as it is stored right now, so an untouched one is never re-copied. */
  const [storedImage, setStoredImage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ title?: string; expiresOn?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!id) return;
    let active = true;

    getDocument(db, id).then((doc) => {
      if (!active || !doc) {
        if (active) setLoading(false);
        return;
      }
      setTitle(doc.title);
      setKind(doc.kind);
      setExpiresOn(doc.expires_on);
      setIssuedOn(doc.issued_on);
      setIssuer(doc.issuer ?? '');
      setReference(doc.reference ?? '');
      setNotes(doc.notes ?? '');
      setImageUri(doc.image_path);
      setStoredImage(doc.image_path);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [db, id]);

  async function save() {
    const nextErrors: typeof errors = {};
    if (!title.trim()) nextErrors.title = 'Give it a name so you recognise it in the list.';
    if (!expiresOn) nextErrors.expiresOn = 'Choose the date it expires.';

    if (Object.keys(nextErrors).length) {
      warningFeedback();
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      // Copied only now, at save. Doing it at pick time would leave an orphaned
      // image in app storage every time someone opened the form and backed out.
      const imagePath =
        imageUri && imageUri !== storedImage
          ? await persistImage(imageUri, id ?? Crypto.randomUUID())
          : imageUri;

      const input = {
        title: title.trim(),
        kind,
        // Past dates are allowed on purpose — people add the licence they
        // already let lapse. It sorts to the top in red with nothing to schedule.
        expiresOn: expiresOn as string,
        issuedOn,
        issuer: issuer.trim() || null,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        imagePath,
      };

      const plan = { offsets: settings.reminderOffsets, hour: settings.reminderHour };
      if (id) await updateDocument(db, id, input, plan);
      else await createDocument(db, input, plan);

      successFeedback();
      router.back();
    } catch {
      warningFeedback();
      setErrors({ save: 'Could not save that. Try again.' });
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.screen}>
        <Stack.Screen options={{ title: 'Edit document' }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: editing ? 'Edit document' : 'Add document' }} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <TextField
            label="What is it?"
            value={title}
            onChangeText={setTitle}
            placeholder="My driver's licence"
            autoCapitalize="sentences"
            error={errors.title}
          />

          <View style={styles.field}>
            <ThemedText type="label" themeColor="textSecondary">
              Type
            </ThemedText>
            <View style={styles.chips}>
              {DOCUMENT_KINDS.map((option) => {
                const { icon, fg, bg } = kindStyle(option, scheme);
                return (
                  <Chip
                    key={option}
                    label={KIND_LABELS[option]}
                    icon={icon}
                    selected={option === kind}
                    tint={{ fg, bg }}
                    onPress={() => setKind(option)}
                  />
                );
              })}
            </View>
          </View>

          <DateField
            label="Expires on"
            value={expiresOn}
            onChange={(value) => {
              setExpiresOn(value);
              setErrors((current) => ({ ...current, expiresOn: undefined }));
            }}
            error={errors.expiresOn}
          />

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <DateField
            label="Issued on"
            value={issuedOn}
            onChange={setIssuedOn}
            optional
            showPresets={false}
          />

          <TextField
            label="Issued by"
            value={issuer}
            onChangeText={setIssuer}
            placeholder="Service NSW, Passport Office…"
            autoCapitalize="words"
            optional
          />

          <TextField
            label="Reference number"
            value={reference}
            onChangeText={setReference}
            placeholder="Policy, licence or membership number"
            autoCapitalize="characters"
            autoCorrect={false}
            optional
            hint="Stored encrypted on this device only."
          />

          <TextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Renewal steps, who to call, what you need to bring"
            multiline
            numberOfLines={4}
            style={styles.notes}
            optional
          />

          <PhotoField uri={imageUri} onChange={setImageUri} />

          {errors.save ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {errors.save}
            </ThemedText>
          ) : null}

          <View style={styles.actions}>
            <Button
              label={editing ? 'Save changes' : 'Save document'}
              icon="check"
              loading={saving}
              onPress={save}
            />
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  field: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  notes: { minHeight: 104, textAlignVertical: 'top', paddingTop: Spacing.three, borderRadius: Radius.medium },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
});
