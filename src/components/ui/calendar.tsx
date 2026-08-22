import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { selectionFeedback } from '@/lib/haptics';
import { todayIso } from '@/lib/expiry';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Day count for a 1-based month. Day 0 of the next month is the last of this one. */
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

/**
 * Which column the 1st falls in, with Monday as column 0. `getDay()` returns
 * Sunday as 0, so the shift is `(day + 6) % 7` — the off-by-one that puts every
 * date in a hand-rolled calendar one square out of place.
 */
const leadingBlanks = (y: number, m: number) => (new Date(y, m - 1, 1).getDay() + 6) % 7;

/**
 * A month grid built from plain integers rather than Date arithmetic. Dates in
 * this app are calendar days, not instants; running them through Date to render
 * a square is how a picker starts showing the wrong month to anyone in UTC+13.
 */
export function Calendar({
  value,
  onSelect,
}: {
  /** Selected day as yyyy-mm-dd, or null when nothing is chosen yet. */
  value: string | null;
  onSelect: (isoDate: string) => void;
}) {
  const theme = useTheme();
  const today = todayIso();

  const initial = useMemo(() => {
    const source = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
    const [y, m] = source.split('-').map(Number);
    return { year: y, month: m };
  }, [value, today]);

  const [view, setView] = useState(initial);

  function shiftMonth(delta: number) {
    selectionFeedback();
    setView((current) => {
      const raw = current.month - 1 + delta;
      return { year: current.year + Math.floor(raw / 12), month: ((raw % 12) + 12) % 12 + 1 };
    });
  }

  const blanks = leadingBlanks(view.year, view.month);
  const total = daysInMonth(view.year, view.month);
  const cells: (number | null)[] = [
    ...Array<null>(blanks).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  // Pad to whole weeks so the grid does not change height month to month —
  // a picker that jumps as you page through it feels broken.
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => shiftMonth(-1)}
          style={[styles.navButton, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="chevron-left" size={22} color={theme.text} />
        </Pressable>

        <ThemedText type="heading">
          {MONTHS[view.month - 1]} {view.year}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => shiftMonth(1)}
          style={[styles.navButton, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="chevron-right" size={22} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day, index) => (
          <View key={index} style={styles.cell}>
            <ThemedText type="caption" themeColor="textTertiary" style={styles.centred}>
              {day}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) return <View key={index} style={styles.cell} />;

          const date = iso(view.year, view.month, day);
          const selected = date === value;
          const isToday = date === today;

          return (
            <View key={index} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  selectionFeedback();
                  onSelect(date);
                }}
                style={({ pressed }) =>
                  ([
                    styles.day,
                    selected && { backgroundColor: theme.tint },
                    !selected && isToday && { borderWidth: 1.5, borderColor: theme.tint },
                    pressed && !selected && { backgroundColor: theme.backgroundElement },
                  ])
                }>
                <ThemedText
                  type="small"
                  style={{
                    color: selected ? theme.onTint : isToday ? theme.tint : theme.text,
                    fontWeight: selected || isToday ? '700' : '500',
                  }}>
                  {day}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
  },
  navButton: { width: 36, height: 36, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Sevenths of the row. Percentage width keeps the grid square on a 320px
  // phone and on a tablet without a measurement pass.
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  centred: { textAlign: 'center' },
});
