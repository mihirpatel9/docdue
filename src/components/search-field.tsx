import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function SearchField({
  value,
  onChange,
  onOpenFilters,
  filterCount,
}: {
  value: string;
  onChange: (next: string) => void;
  onOpenFilters: () => void;
  /** Badge count; 0 leaves the button in its resting state. */
  filterCount: number;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.field,
          { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
        ]}>
        <Icon name="magnify" size={20} color={theme.textTertiary} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChange}
          placeholder="Search name, issuer or number"
          placeholderTextColor={theme.textTertiary}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="never"
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => onChange('')}
            hitSlop={8}>
            <Icon name="close-circle" size={18} color={theme.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filters and sorting"
        onPress={onOpenFilters}
        style={({ pressed }) =>
          ([
            styles.filterButton,
            {
              backgroundColor: filterCount ? theme.tintSurface : theme.backgroundElevated,
              borderColor: filterCount ? theme.tint : theme.border,
            },
            pressed && { opacity: 0.7 },
          ])
        }>
        <Icon
          name="tune-variant"
          size={20}
          color={filterCount ? theme.tint : theme.textSecondary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingHorizontal: Spacing.three - 4,
    height: 46,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
