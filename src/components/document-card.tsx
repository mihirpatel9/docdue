import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { KindTile } from '@/components/kind-tile';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { KIND_LABELS, type DocumentListRow } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import {
  URGENCY_TOKENS,
  daysUntilExpiry,
  expiryBadge,
  expiryProgress,
  formatIsoDateShort,
  urgencyOf,
} from '@/lib/expiry';

/**
 * One document on the home screen.
 *
 * Three signals, deliberately redundant: the countdown badge states the number,
 * the colour states the severity, and the depleting bar states the trend. Colour
 * alone would be unreadable to anyone with a red-green deficiency, and a number
 * alone reads as neutral until you stop and do the arithmetic.
 */
function DocumentCardBase({ doc, onPress }: { doc: DocumentListRow; onPress: () => void }) {
  const theme = useTheme();
  const daysLeft = daysUntilExpiry(doc.expires_on);
  const urgency = urgencyOf(daysLeft);
  const tokens = URGENCY_TOKENS[urgency];
  const accent = theme[tokens.fg];
  const remaining = expiryProgress(daysLeft);

  const subtitle = [formatIsoDateShort(doc.expires_on), doc.issuer].filter(Boolean).join('  ·  ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${doc.title}, ${KIND_LABELS[doc.kind] ?? 'Document'}, ${expiryBadge(daysLeft)}`}
      onPress={onPress}
      style={({ pressed }) =>
        ([
          styles.card,
          Elevation.card,
          { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
          pressed && styles.pressed,
        ])
      }>
      <KindTile kind={doc.kind} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <ThemedText type="label" themeColor="textTertiary" numberOfLines={1} style={styles.kind}>
            {KIND_LABELS[doc.kind] ?? 'Document'}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: theme[tokens.surface] }]}>
            <ThemedText type="caption" style={{ color: accent, fontWeight: '700' }}>
              {expiryBadge(daysLeft)}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="heading" numberOfLines={1}>
          {doc.title}
        </ThemedText>

        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View
            style={[
              styles.fill,
              // A hairline minimum so "expired" still reads as an empty bar
              // rather than as a bar that failed to render.
              { width: `${Math.max(2, remaining * 100)}%`, backgroundColor: accent },
            ]}
          />
        </View>

        <View style={styles.footer}>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </ThemedText>
          {doc.has_image ? (
            <Icon name="image-outline" size={14} color={theme.textTertiary} />
          ) : null}
          {doc.notes ? <Icon name="note-text-outline" size={14} color={theme.textTertiary} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** The list re-renders on every keystroke in the search field; rows should not. */
export const DocumentCard = memo(DocumentCardBase);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  body: { flex: 1, gap: Spacing.one + 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  kind: { flex: 1 },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: Radius.pill },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: Spacing.one },
  fill: { height: 4, borderRadius: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.half },
  subtitle: { flex: 1 },
});
