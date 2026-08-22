import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Grace period before a backgrounded app re-locks. Switching out to read a
 * renewal email and coming straight back should not demand Face ID again;
 * putting the phone down should. Fifteen seconds separates those two.
 */
const RELOCK_AFTER_MS = 15_000;

type LockState = 'locked' | 'unlocked' | 'unavailable';

/**
 * Gates the whole app behind the device biometric.
 *
 * This protects a specific, real threat: someone holding your unlocked phone.
 * It is not what protects the data at rest — SQLCipher does that — and the two
 * are deliberately independent. Biometrics can be bypassed by anyone who knows
 * the device passcode; encryption cannot.
 */
export function AppLock({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  // Web starts unavailable rather than locked. `authenticate` reaches the same
  // conclusion, but only inside an effect — so the server renders a lock screen
  // that hydration immediately throws away, and the preview opens with a flash
  // of a door that was never there.
  const [state, setState] = useState<LockState>(
    Platform.OS === 'web' ? 'unavailable' : 'locked'
  );
  const [failed, setFailed] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const authenticate = useCallback(async () => {
    // The browser has no biometric API to call. The web preview is not the
    // secure product (see IS_INSECURE_PREVIEW) and gating it behind a lock it
    // cannot satisfy would just be an unopenable door.
    if (Platform.OS === 'web') {
      setState('unavailable');
      return;
    }

    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);

    // No biometric hardware, or none enrolled: the phone's own lock screen is
    // the only gate available. Refusing entry here would lock people out of
    // their own documents, which is a worse outcome than the risk it averts.
    if (!hasHardware || !isEnrolled) {
      setState('unavailable');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Expiry Vault',
      cancelLabel: 'Cancel',
      // Device passcode stays enabled as a fallback: a wet or injured finger
      // must not mean losing access to your own passport details.
      disableDeviceFallback: false,
    });

    setState(result.success ? 'unlocked' : 'locked');
    setFailed(!result.success);
  }, []);

  useEffect(() => {
    // Blocks screenshots on Android and hides the app in the iOS app switcher,
    // so a document is not left sitting in a screenshot or a task-switcher
    // thumbnail where any other app or onlooker can reach it.
    // No-op on web, and it throws there rather than returning quietly.
    if (Platform.OS !== 'web') ScreenCapture.preventScreenCaptureAsync();
    authenticate();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }

      if (next === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > RELOCK_AFTER_MS) {
          setState((current) => (current === 'unavailable' ? current : 'locked'));
        }
      }
    });

    return () => {
      subscription.remove();
      if (Platform.OS !== 'web') ScreenCapture.allowScreenCaptureAsync();
    };
  }, [authenticate]);

  if (state === 'unlocked' || state === 'unavailable') return <>{children}</>;

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.panel}>
        <View
          style={[
            styles.shield,
            {
              backgroundColor: failed ? theme.dangerSurface : theme.tintSurface,
              borderColor: failed ? theme.danger : theme.tint,
            },
          ]}>
          <Icon
            name={failed ? 'lock-alert-outline' : 'shield-lock-outline'}
            size={40}
            color={failed ? theme.danger : theme.tint}
          />
        </View>

        <ThemedText type="title" style={styles.title}>
          Expiry Vault
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
          {failed
            ? 'That did not unlock. Try again to see your documents.'
            : 'Your documents are encrypted on this device.'}
        </ThemedText>

        <Button label="Unlock" icon="fingerprint" onPress={authenticate} style={styles.button} />
      </View>

      <View style={styles.footer}>
        <Icon name="cloud-off-outline" size={14} color={theme.textTertiary} />
        <ThemedText type="caption" themeColor="textTertiary">
          Nothing leaves this device
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  panel: { alignItems: 'center', gap: Spacing.two, maxWidth: 320, width: '100%' },
  shield: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: Spacing.four, borderRadius: Radius.medium },
  footer: {
    position: 'absolute',
    bottom: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
});
