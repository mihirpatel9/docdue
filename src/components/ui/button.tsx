import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: theme.tint, fg: theme.onTint, border: 'transparent' },
    secondary: { bg: theme.backgroundElement, fg: theme.text, border: theme.border },
    ghost: { bg: 'transparent', fg: theme.tint, border: 'transparent' },
    destructive: { bg: theme.dangerSurface, fg: theme.danger, border: 'transparent' },
  };

  const { bg, fg, border } = palette[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) =>
        ([
          styles.base,
          { backgroundColor: bg, borderColor: border },
          // Opacity rather than a second colour token per variant: one rule that
          // reads correctly on every background, including the transparent one.
          pressed && styles.pressed,
          inactive && styles.inactive,
          style,
        ])
      }>
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={fg} /> : null}
        {!loading && icon ? <Icon name={icon} size={18} color={fg} /> : null}
        <ThemedText type="default" style={[styles.label, { color: fg }]}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { fontWeight: '600' },
  pressed: { opacity: 0.72 },
  inactive: { opacity: 0.45 },
});
