import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { selectionFeedback } from '@/lib/haptics';

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tint,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  /** Override for kind chips, which carry their own hue. */
  tint?: { fg: string; bg: string };
}) {
  const theme = useTheme();

  const background = selected ? (tint?.bg ?? theme.tintSurface) : theme.backgroundElement;
  const foreground = selected ? (tint?.fg ?? theme.tint) : theme.textSecondary;
  const border = selected ? (tint?.fg ?? theme.tint) : theme.border;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        selectionFeedback();
        onPress();
      }}
      style={({ pressed }) =>
        ([
          styles.chip,
          { backgroundColor: background, borderColor: border },
          pressed && styles.pressed,
        ])
      }>
      {icon ? <Icon name={icon} size={15} color={foreground} /> : null}
      <ThemedText type="small" style={{ color: foreground, fontWeight: selected ? '700' : '500' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
});
