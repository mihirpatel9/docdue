import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';
import { captureWithCamera, pickFromLibrary, type PickResult } from '@/lib/images';

/**
 * Attaches one photo to a document.
 *
 * The picked URI is held, not copied, until the document is saved — copying at
 * pick time would litter app storage with orphaned images every time someone
 * opened the form and backed out.
 */
export function PhotoField({
  uri,
  onChange,
}: {
  uri: string | null;
  onChange: (uri: string | null) => void;
}) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<PickResult>) {
    tapFeedback();
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result && 'error' in result) setError(result.error);
      else if (result) onChange(result.uri);
    } catch {
      setError('Could not open that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <ThemedText type="label" themeColor="textSecondary">
          Photo
        </ThemedText>
        <ThemedText type="caption" themeColor="textTertiary">
          Optional
        </ThemedText>
      </View>

      {uri ? (
        <View style={[styles.preview, { borderColor: theme.border }]}>
          <Image source={{ uri }} style={styles.image} contentFit="cover" transition={150} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            onPress={() => {
              tapFeedback();
              onChange(null);
            }}
            style={[styles.remove, { backgroundColor: theme.overlay }]}>
            <Icon name="close" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <PhotoAction
            icon="camera-outline"
            label="Take photo"
            disabled={busy}
            onPress={() => run(captureWithCamera)}
          />
          <PhotoAction
            icon="image-outline"
            label="Choose photo"
            disabled={busy}
            onPress={() => run(pickFromLibrary)}
          />
        </View>
      )}

      {error ? (
        <ThemedText type="caption" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : (
        <ThemedText type="caption" themeColor="textTertiary">
          Stored in this app&apos;s private storage on your device. Never uploaded.
        </ThemedText>
      )}
    </View>
  );
}

function PhotoAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'camera-outline' | 'image-outline';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) =>
        ([
          styles.action,
          { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
          (pressed || disabled) && { opacity: 0.6 },
        ])
      }>
      <Icon name={icon} size={22} color={theme.tint} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  preview: { borderRadius: Radius.medium, overflow: 'hidden', borderWidth: 1 },
  image: { width: '100%', aspectRatio: 1.6 },
  remove: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
