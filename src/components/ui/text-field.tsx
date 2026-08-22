import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function TextField({
  label,
  hint,
  error,
  optional,
  style,
  ...input
}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  // Focus and error share one border slot, and error wins. A field can be both,
  // and the thing the user needs to see is the problem.
  const borderColor = error ? theme.danger : focused ? theme.tint : theme.border;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <ThemedText type="label" themeColor="textSecondary">
          {label}
        </ThemedText>
        {optional ? (
          <ThemedText type="caption" themeColor="textTertiary">
            Optional
          </ThemedText>
        ) : null}
      </View>

      <TextInput
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElevated, color: theme.text, borderColor },
          style,
        ]}
        placeholderTextColor={theme.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...input}
      />

      {error ? (
        <ThemedText type="caption" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="caption" themeColor="textTertiary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
    fontSize: 16,
  },
});
