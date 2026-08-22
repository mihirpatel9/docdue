import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';
import { daysUntilExpiry, formatIsoDate } from '@/lib/expiry';

/**
 * The shortcuts that cover most of what this app stores. A passport is ten
 * years, a licence five, most insurance one — offering those as one tap is the
 * difference between adding a document in three seconds and in thirty.
 */
const PRESETS: { label: string; years: number }[] = [
  { label: '+1 year', years: 1 },
  { label: '+2 years', years: 2 },
  { label: '+5 years', years: 5 },
  { label: '+10 years', years: 10 },
];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Today plus `years`, clamped to the last valid day of the target month so
 * 29 February plus one year lands on 28 February rather than rolling into March.
 */
function addYears(years: number): string {
  const now = new Date();
  const year = now.getFullYear() + years;
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${pad(month)}-${pad(Math.min(now.getDate(), lastDay))}`;
}

export function DateField({
  label,
  value,
  onChange,
  optional,
  error,
  showPresets = true,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  optional?: boolean;
  error?: string | null;
  showPresets?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const daysLeft = value ? daysUntilExpiry(value) : null;
  const isPast = daysLeft !== null && daysLeft < 0;

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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${formatIsoDate(value)}` : `Choose ${label}`}
        onPress={() => {
          tapFeedback();
          setOpen(true);
        }}
        style={({ pressed }) =>
          ([
            styles.trigger,
            {
              backgroundColor: theme.backgroundElevated,
              borderColor: error ? theme.danger : theme.border,
            },
            pressed && { opacity: 0.7 },
          ])
        }>
        <Icon name="calendar-blank-outline" size={20} color={theme.textSecondary} />
        <ThemedText
          type="default"
          style={{ color: value ? theme.text : theme.textTertiary, flex: 1 }}>
          {value ? formatIsoDate(value) : 'Choose a date'}
        </ThemedText>
        <Icon name="chevron-right" size={20} color={theme.textTertiary} />
      </Pressable>

      {error ? (
        <ThemedText type="caption" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : isPast ? (
        <ThemedText type="caption" style={{ color: theme.warning }}>
          That date has passed. It will be saved and flagged as expired.
        </ThemedText>
      ) : null}

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.overlay }]}
          onPress={() => setOpen(false)}>
          {/*
            The sheet swallows presses so a tap inside it never reaches the
            backdrop's dismiss handler — otherwise picking a date closes the
            picker before the selection registers.
          */}
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.background }]}
            onPress={(event) => event.stopPropagation()}>
            <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />

            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}>
              <Calendar value={value} onSelect={onChange} />

              {showPresets ? (
                <View style={styles.presets}>
                  {PRESETS.map((preset) => (
                    <Pressable
                      key={preset.label}
                      accessibilityRole="button"
                      onPress={() => {
                        tapFeedback();
                        onChange(addYears(preset.years));
                      }}
                      style={({ pressed }) =>
                        ([
                          styles.preset,
                          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                          pressed && { opacity: 0.7 },
                        ])
                      }>
                      <ThemedText type="small" style={{ color: theme.tint, fontWeight: '600' }}>
                        {preset.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={styles.actions}>
                {optional && value ? (
                  <Button
                    label="Clear"
                    variant="secondary"
                    style={styles.action}
                    onPress={() => {
                      onChange(null);
                      setOpen(false);
                    }}
                  />
                ) : null}
                <Button label="Done" style={styles.action} onPress={() => setOpen(false)} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xlarge,
    borderTopRightRadius: Radius.xlarge,
    paddingTop: Spacing.two,
    maxHeight: '88%',
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.two },
  sheetContent: { padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.three },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  preset: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
