import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { IS_INSECURE_PREVIEW } from '@/db/init';
import type { ReminderPlan } from '@/db/documents';
import { useTheme } from '@/hooks/use-theme';
import { successFeedback, tapFeedback, warningFeedback } from '@/lib/haptics';
import {
  FILE_EXTENSION,
  MIME_TYPE,
  MIN_PASSPHRASE_LENGTH,
  STRENGTH_LABELS,
  discardExport,
  exportVault,
  importVault,
  ratePassphrase,
  rescheduleAfterImport,
} from '@/lib/vault-export';

type Mode = 'export' | 'import';

/**
 * Backup and restore.
 *
 * The passphrase is asked for here and never stored. That is the deliberate
 * shape of the feature: the vault's own key is hardware-backed and
 * `THIS_DEVICE_ONLY`, so it cannot travel — a backup that could be opened
 * without a passphrase would either have to carry that key (defeating the
 * point) or not be encrypted at all.
 */
export function BackupPanel({ plan, onImported }: { plan: ReminderPlan; onImported: () => void }) {
  const db = useSQLiteContext();
  const theme = useTheme();

  const [mode, setMode] = useState<Mode | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const strength = ratePassphrase(passphrase);
  const tooShort = passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE_LENGTH;
  const mismatch = mode === 'export' && confirmation.length > 0 && confirmation !== passphrase;
  const canSubmit =
    passphrase.length >= MIN_PASSPHRASE_LENGTH && (mode === 'import' || confirmation === passphrase);

  function close() {
    setMode(null);
    // Wiping these on close keeps the passphrase out of component state for any
    // longer than the dialog is actually open.
    setPassphrase('');
    setConfirmation('');
    setPendingFile(null);
    setError(null);
    setBusy(false);
  }

  function begin(next: Mode) {
    tapFeedback();
    setDone(null);
    setError(null);
    setPassphrase('');
    setConfirmation('');
    setPendingFile(null);
    setMode(next);
  }

  /** Picks the file first, so a wrong file is caught before typing a passphrase. */
  async function chooseFile() {
    tapFeedback();
    setError(null);

    const result = await DocumentPicker.getDocumentAsync({
      // Backups have a custom extension the OS has no type for, so filtering to
      // a MIME type would grey out the very file the user came here to pick.
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.name.endsWith(`.${FILE_EXTENSION}`)) {
      setError(`That is not an Expiry Vault backup. Look for a .${FILE_EXTENSION} file.`);
      return;
    }

    setPendingFile(asset.uri);
  }

  async function runExport() {
    setBusy(true);
    setError(null);

    let file;
    try {
      file = await exportVault(db, passphrase);
    } catch {
      warningFeedback();
      setError('Could not create the backup. Try again.');
      setBusy(false);
      return;
    }

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: MIME_TYPE,
          dialogTitle: 'Save your Expiry Vault backup',
          UTI: 'public.data',
        });
      } else {
        setError('This device has nowhere to send the file.');
        setBusy(false);
        return;
      }
    } finally {
      // Always, whether the share completed or the user backed out. An
      // encrypted copy of the whole vault should not sit in the cache waiting
      // to be found.
      await discardExport(file);
    }

    successFeedback();
    setDone('Backup saved. Keep the passphrase somewhere safe — it cannot be recovered.');
    close();
  }

  async function runImport() {
    if (!pendingFile) return;
    setBusy(true);
    setError(null);

    try {
      const result = await importVault(db, pendingFile, passphrase);
      // Reminders are rebuilt rather than restored: the handles in the backup
      // belong to whichever phone wrote it.
      await rescheduleAfterImport(db, plan);

      successFeedback();
      setDone(
        result.documents === 0
          ? 'Nothing new to restore — this vault is already up to date.'
          : `Restored ${result.documents} document${result.documents === 1 ? '' : 's'}` +
              `${result.photos > 0 ? ` and ${result.photos} photo${result.photos === 1 ? '' : 's'}` : ''}.`
      );
      close();
      onImported();
    } catch (caught) {
      warningFeedback();
      setError(
        caught instanceof Error && caught.name === 'WrongPassphraseError'
          ? 'That passphrase does not open this backup.'
          : caught instanceof Error && caught.name === 'IncompatibleBackupError'
            ? caught.message
            : 'Could not read that backup. The file may be damaged.'
      );
      setBusy(false);
    }
  }

  if (IS_INSECURE_PREVIEW) {
    return (
      <ThemedText type="caption" themeColor="textTertiary">
        Backups need the iOS or Android app — the browser preview has no encryption to back up.
      </ThemedText>
    );
  }

  return (
    <>
      <View style={styles.rows}>
        <View style={styles.row}>
          <Icon name="download-outline" size={20} color={theme.textSecondary} style={styles.icon} />
          <View style={styles.body}>
            <ThemedText type="default" style={styles.title}>
              Back up the vault
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              One encrypted file, locked with a passphrase you choose.
            </ThemedText>
          </View>
        </View>
        <Button label="Create backup" icon="download-outline" onPress={() => begin('export')} />

        <View style={[styles.separator, { backgroundColor: theme.border }]} />

        <View style={styles.row}>
          <Icon name="upload-outline" size={20} color={theme.textSecondary} style={styles.icon} />
          <View style={styles.body}>
            <ThemedText type="default" style={styles.title}>
              Restore from a backup
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              Merges into this vault. Newer edits on this phone are kept.
            </ThemedText>
          </View>
        </View>
        <Button
          label="Restore backup"
          variant="secondary"
          icon="upload-outline"
          onPress={() => begin('import')}
        />

        {done ? (
          <ThemedText type="small" style={{ color: theme.success }}>
            {done}
          </ThemedText>
        ) : null}
      </View>

      <Modal visible={mode !== null} transparent animationType="fade" onRequestClose={close}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.overlay }]}
          onPress={busy ? undefined : close}>
          <Pressable
            style={[styles.dialog, { backgroundColor: theme.background }]}
            onPress={(event) => event.stopPropagation()}>
            <ThemedText type="heading">
              {mode === 'export' ? 'Choose a passphrase' : 'Restore a backup'}
            </ThemedText>

            {mode === 'export' ? (
              <ThemedText type="small" themeColor="textSecondary">
                This passphrase is the only key to the backup file. Nobody — not this app, not us —
                can open it or recover it for you. Write it down somewhere safe.
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Pick the backup file, then enter the passphrase it was created with.
              </ThemedText>
            )}

            {mode === 'import' ? (
              <Button
                label={pendingFile ? 'Choose a different file' : 'Choose backup file'}
                variant="secondary"
                icon="file-outline"
                onPress={chooseFile}
              />
            ) : null}

            {mode === 'export' || pendingFile ? (
              <>
                <TextField
                  label="Passphrase"
                  value={passphrase}
                  onChangeText={setPassphrase}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  error={tooShort ? STRENGTH_LABELS['too-short'] : null}
                  hint={
                    mode === 'export' && !tooShort && passphrase.length > 0
                      ? STRENGTH_LABELS[strength]
                      : undefined
                  }
                />

                {mode === 'export' ? (
                  <TextField
                    label="Confirm passphrase"
                    value={confirmation}
                    onChangeText={setConfirmation}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    error={mismatch ? 'These do not match.' : null}
                  />
                ) : null}
              </>
            ) : null}

            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            ) : null}

            <View style={styles.actions}>
              <Button
                label="Cancel"
                variant="secondary"
                disabled={busy}
                style={styles.action}
                onPress={close}
              />
              <Button
                label={mode === 'export' ? 'Create' : 'Restore'}
                loading={busy}
                disabled={!canSubmit || busy || (mode === 'import' && !pendingFile)}
                style={styles.action}
                onPress={mode === 'export' ? runExport : runImport}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  rows: { gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  icon: { width: 22 },
  body: { flex: 1, gap: 1 },
  title: { fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  action: { flex: 1 },
});
