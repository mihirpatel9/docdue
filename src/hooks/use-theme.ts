/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, type Theme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettings } from '@/hooks/use-settings';

/**
 * The scheme actually in force: the user's explicit choice when they have made
 * one, the system otherwise. Outside the settings provider — the lock screen,
 * before the vault opens — this falls back to the system scheme, which is the
 * right answer for a screen that shows no documents anyway.
 */
export function useResolvedScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const { settings } = useSettings();

  if (settings.themeMode !== 'system') return settings.themeMode;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme(): Theme {
  return Colors[useResolvedScheme()];
}
