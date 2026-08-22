import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppLock } from '@/components/app-lock';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { openVault } from '@/db/init';
import { SettingsProvider } from '@/hooks/use-settings';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { ensureNotificationSetup } from '@/lib/notifications';

/**
 * Shown when the vault cannot be opened — in practice, when the build has no
 * SQLCipher and the data would otherwise be written in the clear. Deliberately
 * a dead end with no "continue anyway": the whole promise of this app is that
 * the documents are encrypted, and an app that quietly breaks that promise is
 * worse than one that refuses to open.
 */
function VaultUnavailable({ error }: { error: Error }) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.error}>
      <Icon name="shield-alert-outline" size={44} color={theme.danger} />
      <ThemedText type="subtitle" style={styles.centred}>
        Vault unavailable
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.centred}>
        {error.message}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * Navigation chrome painted from the app's own tokens rather than from React
 * Navigation's stock light and dark themes, so a header and the screen beneath
 * it are never two slightly different whites.
 */
function Navigation() {
  const scheme = useResolvedScheme();
  const theme = useTheme();

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.tint,
        background: theme.background,
        card: theme.background,
        text: theme.text,
        border: theme.border,
      },
    };
  }, [scheme, theme]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: theme.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="document/[id]" options={{ title: '' }} />
      </Stack>
    </ThemeProvider>
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
      <SettingsProvider>
        <Navigation />
      </SettingsProvider>
    </SQLiteProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Asked for once at startup rather than at the moment of saving, so a
    // denied prompt never costs the user the document they just typed in.
    ensureNotificationSetup();
  }, []);

  // AppLock stays outside the provider on purpose: the vault is not opened, and
  // the key is not fetched from the Keychain, until the biometric has passed.
  return (
    <AppLock>
      <Vault />
    </AppLock>
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
  centred: { textAlign: 'center' },
});
