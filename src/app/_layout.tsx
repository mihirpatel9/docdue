import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { AppLock } from '@/components/app-lock';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { openVault } from '@/db/init';
import { ensureNotificationSetup } from '@/lib/notifications';

/**
 * Shown when the vault cannot be opened — in practice, when the build has no
 * SQLCipher and the data would otherwise be written in the clear. Deliberately
 * a dead end with no "continue anyway": the whole promise of this app is that
 * the documents are encrypted, and an app that quietly breaks that promise is
 * worse than one that refuses to open.
 */
function VaultUnavailable({ error }: { error: Error }) {
  return (
    <ThemedView style={styles.error}>
      <ThemedText type="subtitle" style={styles.errorTitle}>
        Vault unavailable
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.errorBody}>
        {error.message}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * SQLiteProvider reports init failures through onError and then renders
 * nothing, so the error is held here — otherwise a refusal to open an
 * unencrypted vault would look identical to a blank screen.
 */
function Vault() {
  const [error, setError] = useState<Error | null>(null);

  if (error) return <VaultUnavailable error={error} />;

  return (
    <SQLiteProvider databaseName="expiry-vault.db" onInit={openVault} onError={setError}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Expiry Vault' }} />
        <Stack.Screen name="add" options={{ title: 'Add document', presentation: 'modal' }} />
      </Stack>
    </SQLiteProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Asked for once at startup rather than at the moment of saving, so a
    // denied prompt never costs the user the document they just typed in.
    ensureNotificationSetup();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppLock>
        <Vault />
      </AppLock>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  errorTitle: { textAlign: 'center' },
  errorBody: { textAlign: 'center' },
});
