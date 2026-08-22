import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { URGENCY_LABELS, URGENCY_TOKENS, type Urgency } from '@/lib/expiry';
import { selectionFeedback } from '@/lib/haptics';
import type { Summary } from '@/lib/grouping';

const ORDER: Urgency[] = ['expired', 'critical', 'soon', 'ok'];

/**
 * The dashboard strip above the list.
 *
 * The tiles are filter controls, not decoration. A count that tells you two
 * things need attention and then makes you go and find them is a worse design
 * than one you can tap — so tapping a tile filters the list to it.
 */
export function SummaryHeader({
  summary,
  active,
  onToggle,
}: {
  summary: Summary;
  active: Urgency[];
  onToggle: (urgency: Urgency) => void;
}) {
  const theme = useTheme();
  const needsAttention = summary.expired + summary.critical;

  return (
    <View style={styles.wrapper}>
      <View style={styles.headline}>
        <ThemedText type="title">Documents</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {summary.total === 0
            ? 'Nothing stored yet'
            : needsAttention > 0
              ? `${summary.total} stored · ${needsAttention} need${needsAttention === 1 ? 's' : ''} attention`
              : `${summary.total} stored · all current`}
        </ThemedText>
      </View>

      <View style={styles.tiles}>
        {ORDER.map((urgency) => {
          const count = summary[urgency];
          const tokens = URGENCY_TOKENS[urgency];
          const selected = active.includes(urgency);
          // Zero counts stay visible but recede. Hiding them would make the row
          // reflow every time a document crossed a threshold.
          const dimmed = count === 0 && !selected;

          return (
            <Pressable
              key={urgency}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${count} ${URGENCY_LABELS[urgency]}`}
              onPress={() => {
                selectionFeedback();
                onToggle(urgency);
              }}
              style={({ pressed }) =>
                ([
                  styles.tile,
                  {
                    backgroundColor: selected ? theme[tokens.surface] : theme.backgroundElevated,
                    borderColor: selected ? theme[tokens.fg] : theme.border,
                  },
                  dimmed && styles.dimmed,
                  pressed && styles.pressed,
                ])
              }>
              <ThemedText type="subtitle" style={{ color: theme[tokens.fg] }}>
                {count}
              </ThemedText>
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                numberOfLines={1}
                style={styles.tileLabel}>
                {URGENCY_LABELS[urgency]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.three },
  headline: { gap: Spacing.half },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  tile: {
    flex: 1,
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    gap: 1,
  },
  tileLabel: { textAlign: 'center' },
  dimmed: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
