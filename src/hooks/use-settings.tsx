import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_SETTINGS, loadSettings, saveSetting, type Settings } from '@/db/settings';

type SettingsContextValue = {
  settings: Settings;
  /** False until the first read completes, so screens can avoid a theme flash. */
  ready: boolean;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
};

/**
 * The default value is a working one, not a throw. `useTheme` is called from
 * the lock screen, which renders before the vault is open and therefore outside
 * this provider — a hook that threw there would make the app unopenable.
 */
const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  ready: false,
  update: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadSettings(db)
      .then((loaded) => {
        if (active) setSettings(loaded);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [db]);

  const update = useCallback<SettingsContextValue['update']>(
    async (key, value) => {
      // Optimistic: a toggle that waits on a disk write to move looks broken.
      setSettings((current) => ({ ...current, [key]: value }));
      await saveSetting(db, key, value);
    },
    [db]
  );

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
