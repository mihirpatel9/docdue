import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Radius, Spacing } from '@/constants/theme';
import { DOCUMENT_KINDS, KIND_LABELS, type DocumentKind } from '@/db/types';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { EMPTY_FILTERS, type Filters, type SortMode } from '@/lib/grouping';
import { kindStyle } from '@/lib/kinds';

const SORTS: { mode: SortMode; label: string }[] = [
  { mode: 'expiry', label: 'Soonest' },
  { mode: 'title', label: 'Name' },
  { mode: 'kind', label: 'Type' },
];

export function FilterSheet({
  visible,
  filters,
  onChange,
  onClose,
}: {
  visible: boolean;
  filters: Filters;
  onChange: (next: Filters) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const scheme = useResolvedScheme();

  function toggleKind(kind: DocumentKind) {
    const kinds = filters.kinds.includes(kind)
      ? filters.kinds.filter((k) => k !== kind)
      : [...filters.kinds, kind];
    onChange({ ...filters, kinds });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.background }]}
          onPress={(event) => event.stopPropagation()}>
          <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ThemedText type="subtitle">Filter &amp; sort</ThemedText>

            <View style={styles.group}>
              <ThemedText type="label" themeColor="textSecondary">
                Sort by
              </ThemedText>
              <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
                {SORTS.map((option) => {
                  const selected = filters.sort === option.mode;
                  return (
                    <Pressable
                      key={option.mode}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => onChange({ ...filters, sort: option.mode })}
                      style={[
                        styles.segment,
                        selected && { backgroundColor: theme.backgroundElevated },
                      ]}>
                      <ThemedText
                        type="small"
                        style={{
                          color: selected ? theme.text : theme.textSecondary,
                          fontWeight: selected ? '700' : '500',
                        }}>
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.group}>
              <ThemedText type="label" themeColor="textSecondary">
                Type
              </ThemedText>
              <View style={styles.chips}>
                {DOCUMENT_KINDS.map((kind) => {
                  const { icon, fg, bg } = kindStyle(kind, scheme);
                  return (
                    <Chip
                      key={kind}
                      label={KIND_LABELS[kind]}
                      icon={icon}
                      selected={filters.kinds.includes(kind)}
                      tint={{ fg, bg }}
                      onPress={() => toggleKind(kind)}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                label="Reset"
                variant="secondary"
                style={styles.action}
                // Keeps the query: the user is adjusting filters, not abandoning
                // the search they just typed.
                onPress={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
              />
              <Button label="Show results" style={styles.action} onPress={onClose} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xlarge,
    borderTopRightRadius: Radius.xlarge,
    paddingTop: Spacing.two,
    maxHeight: '85%',
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.two },
  content: { padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.four },
  group: { gap: Spacing.two },
  segmented: { flexDirection: 'row', borderRadius: Radius.medium, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Radius.small + 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
