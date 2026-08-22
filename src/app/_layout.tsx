import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { migrateDbIfNeeded } from '@/db/migrations';
import { ensureNotificationSetup } from '@/lib/notifications';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Asked for once at startup rather than at the moment of saving, so a
    // denied prompt never costs the user the document they just typed in.
    ensureNotificationSetup();
  }, []);

  return (
    <SQLiteProvider databaseName="expiry-vault.db" onInit={migrateDbIfNeeded}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Expiry Vault' }} />
          <Stack.Screen
            name="add"
            options={{ title: 'Add document', presentation: 'modal' }}
          />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
