import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentCard } from '@/components/document-card';
import { FilterSheet } from '@/components/filter-sheet';
import { SearchField } from '@/components/search-field';
import { SummaryHeader } from '@/components/summary-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Elevation, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { listDocuments } from '@/db/documents';
import { IS_INSECURE_PREVIEW } from '@/db/init';
import type { DocumentListRow } from '@/db/types';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { URGENCY_TOKENS, type Urgency } from '@/lib/expiry';
import { EMPTY_FILTERS, buildSections, hasActiveFilters, summarise } from '@/lib/grouping';
import { tapFeedback } from '@/lib/haptics';

/**
 * Deliberately loud and permanent. A preview that looks like the real app is
 * how someone ends up typing a real passport number into unencrypted browser
 * storage.
 */
function PreviewBanner() {
  const theme = useTheme();
  if (!IS_INSECURE_PREVIEW) return null;

  return (
    <View style={[styles.banner, { backgroundColor: theme.dangerSurface, borderColor: theme.danger }]}>
      <Icon name="alert-circle-outline" size={20} color={theme.danger} />
      <View style={styles.bannerBody}>
        <ThemedText type="smallBold" style={{ color: theme.danger }}>
          Browser preview — not encrypted
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.danger }}>
          No Keychain, no biometrics, no reminders here. Use test data only; the real app is iOS
          and Android.
        </ThemedText>
      </View>
    </View>
  );
}

function EmptyVault({ onAdd }: { onAdd: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.tintSurface }]}>
        <Icon name="folder-open-outline" size={34} color={theme.tint} />
      </View>
      <ThemedText type="subtitle" style={styles.centred}>
        Nothing expiring
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.centred}>
        Add your licence, passport, registration or a warranty. We&apos;ll remind you well before
        it runs out.
      </ThemedText>
      <Button label="Add your first document" icon="plus" onPress={onAdd} style={styles.emptyAction} />
    </View>
  );
}

function NoMatches({ onReset }: { onReset: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElement }]}>
        <Icon name="magnify" size={32} color={theme.textTertiary} />
      </View>
      <ThemedText type="heading" style={styles.centred}>
        No documents match
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>
        Try a different search, or clear the filters you have applied.
      </ThemedText>
      <Button label="Clear filters" variant="secondary" onPress={onReset} style={styles.emptyAction} />
    </View>
  );
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();

  const [documents, setDocuments] = useState<DocumentListRow[]>([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const rows = await listDocuments(db);
    setDocuments(rows);
    setLoaded(true);
  }, [db]);

  // Reloads on focus rather than on mount, so returning from the form shows the
  // new document without any cross-screen state plumbing.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listDocuments(db).then((rows) => {
        if (!active) return;
        setDocuments(rows);
        setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [db])
  );

  const summary = useMemo(() => summarise(documents), [documents]);
  const sections = useMemo(
    () => buildSections(documents, filters, { showExpired: settings.showExpired }),
    [documents, filters, settings.showExpired]
  );

  const filterCount = filters.kinds.length + filters.urgencies.length + (filters.sort !== 'expiry' ? 1 : 0);
  const filtering = !!filters.query || hasActiveFilters(filters);

  function toggleUrgency(urgency: Urgency) {
    setFilters((current) => ({
      ...current,
      urgencies: current.urgencies.includes(urgency)
        ? current.urgencies.filter((u) => u !== urgency)
        : [...current.urgencies, urgency],
    }));
  }

  return (
    <ThemedView style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.textTertiary}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <PreviewBanner />
            <SummaryHeader
              summary={summary}
              active={filters.urgencies}
              onToggle={toggleUrgency}
            />
            {documents.length > 0 ? (
              <SearchField
                value={filters.query}
                onChange={(query) => setFilters((current) => ({ ...current, query }))}
                onOpenFilters={() => setFiltersOpen(true)}
                filterCount={filterCount}
              />
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
            <View style={[styles.dot, { backgroundColor: theme[URGENCY_TOKENS[section.urgency].fg] }]} />
            <ThemedText type="label" themeColor="textSecondary">
              {section.title}
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              {section.data.length}
            </ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <DocumentCard
            doc={item}
            onPress={() => {
              tapFeedback();
              router.push({ pathname: '/document/[id]', params: { id: item.id } });
            }}
          />
        )}
        SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
        ItemSeparatorComponent={() => <View style={styles.itemGap} />}
        ListEmptyComponent={
          // `loaded` guards the gap between mount and the first query returning:
          // without it the empty state flashes on every launch.
          !loaded ? null : filtering ? (
            <NoMatches onReset={() => setFilters(EMPTY_FILTERS)} />
          ) : (
            <EmptyVault onAdd={() => router.push('/form')} />
          )
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add document"
        onPress={() => {
          tapFeedback();
          router.push('/form');
        }}
        style={({ pressed }) =>
          ([
            styles.fab,
            Elevation.raised,
            { backgroundColor: theme.tint, bottom: insets.bottom + Spacing.four },
            pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
          ])
        }>
        <Icon name="plus" size={28} color={theme.onTint} />
      </Pressable>

      <FilterSheet
        visible={filtersOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: Spacing.three, paddingBottom: Spacing.two },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionGap: { height: Spacing.one },
  itemGap: { height: Spacing.two + 2 },
  banner: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three - 4,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  bannerBody: { flex: 1, gap: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyAction: { marginTop: Spacing.three, alignSelf: 'stretch', maxWidth: 320 },
  centred: { textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
