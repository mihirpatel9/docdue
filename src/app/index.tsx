import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listDocuments } from '@/db/documents';
import { KIND_LABELS, type DocumentRow } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { URGENCY_COLORS, daysUntilExpiry, expiryLabel, urgencyOf } from '@/lib/expiry';

function DocumentCard({ doc }: { doc: DocumentRow }) {
  const theme = useTheme();
  const daysLeft = daysUntilExpiry(doc.expires_on);
  const accent = URGENCY_COLORS[urgencyOf(daysLeft)];

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {KIND_LABELS[doc.kind] ?? 'Document'}
        </ThemedText>
        <ThemedText type="default" style={styles.cardTitle}>
          {doc.title}
        </ThemedText>
        <ThemedText type="small" style={{ color: accent }}>
          {expiryLabel(daysLeft)}
        </ThemedText>
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        Nothing expiring
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.emptyBody}>
        Add your licence, passport, registration or a warranty. We&apos;ll remind you
        30 days, 7 days and the morning it runs out.
      </ThemedText>
    </View>
  );
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  // Reloads on focus rather than on mount, so returning from the add screen
  // shows the new document without any cross-screen state plumbing.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listDocuments(db).then((rows) => {
        if (active) setDocuments(rows);
      });
      return () => {
        active = false;
      };
    }, [db])
  );

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DocumentCard doc={item} />}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={styles.list}
      />

      <Link href="/add" asChild>
        <Pressable style={[styles.fab, { backgroundColor: theme.text }]}>
          <ThemedText
            type="subtitle"
            style={[styles.fabLabel, { color: theme.background }]}>
            +
          </ThemedText>
        </Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.three, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
  },
  accent: { width: 6 },
  cardBody: { flex: 1, padding: Spacing.three, gap: Spacing.one },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  emptyTitle: { textAlign: 'center' },
  emptyBody: { textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.five,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: { lineHeight: 38, fontSize: 34 },
});
