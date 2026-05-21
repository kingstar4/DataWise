import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppUsageRow,
  Card,
  FilterChip,
  HeroHeader,
  InsightCard,
  SearchInput,
  SensitiveValue,
  SkeletonAppList,
  ThemeToggle,
} from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/use-theme';
import { formatBytes, type FormattedAppData, useDataUsage } from '@/hooks/useDataUsage';

const FILTERS = ['All', 'Social', 'Streaming', 'Browser', 'System'];

// Map known package names to categories
function categorizeApp(packageName: string): string {
  const pkg = packageName.toLowerCase();
  if (
    pkg.includes('instagram') ||
    pkg.includes('facebook') ||
    pkg.includes('whatsapp') ||
    pkg.includes('twitter') ||
    pkg.includes('tiktok') ||
    pkg.includes('snapchat') ||
    pkg.includes('telegram') ||
    pkg.includes('discord') ||
    pkg.includes('linkedin') ||
    pkg.includes('threads') ||
    pkg.includes('reddit') ||
    pkg.includes('pinterest')
  ) return 'Social';

  if (
    pkg.includes('youtube') ||
    pkg.includes('netflix') ||
    pkg.includes('spotify') ||
    pkg.includes('music') ||
    pkg.includes('video') ||
    pkg.includes('twitch') ||
    pkg.includes('disney') ||
    pkg.includes('hbo') ||
    pkg.includes('prime') ||
    pkg.includes('deezer') ||
    pkg.includes('audiomack')
  ) return 'Streaming';

  if (
    pkg.includes('chrome') ||
    pkg.includes('firefox') ||
    pkg.includes('browser') ||
    pkg.includes('opera') ||
    pkg.includes('brave') ||
    pkg.includes('edge') ||
    pkg.includes('safari') ||
    pkg.includes('samsung.sbrowser')
  ) return 'Browser';

  if (
    pkg.includes('android.') ||
    pkg.includes('google.android.gms') ||
    pkg.includes('google.android.gsf') ||
    pkg.includes('system') ||
    pkg.includes('qualcomm') ||
    pkg.includes('services')
  ) return 'System';

  return 'Other';
}

// Generate a subtitle from app data
function generateSubtitle(app: FormattedAppData): string {
  const category = categorizeApp(app.packageName);
  const bgPercent = app.totalBytes > 0
    ? Math.round((app.backgroundBytes / app.totalBytes) * 100)
    : 0;

  if (bgPercent > 50) {
    return `${category} • High Background`;
  }
  if (bgPercent > 20) {
    return `${category} • Background Sync`;
  }
  return `${category} • Foreground`;
}

// Rotating palette for app icons
const APP_COLORS = [
  '#6366F1', '#EC4899', '#EF4444', '#10B981', '#14B8A6',
  '#3B82F6', '#F97316', '#8B5CF6', '#06B6D4', '#F59E0B',
];

export default function BreakdownScreen() {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(0);

  // Default to "week" period for the breakdown view
  const { apps, formattedTotal, grandTotal, isLoading, refetch } = useDataUsage('week');

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 800);
  }, [refetch]);

  // Compute average daily
  const avgDaily = useMemo(() => {
    const days = 7;
    return formatBytes(days > 0 ? grandTotal / days : 0);
  }, [grandTotal]);

  // Filter and search
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchesSearch = app.appName.toLowerCase().includes(searchQuery.toLowerCase());
      const category = categorizeApp(app.packageName);
      const matchesFilter = activeFilter === 0 || category === FILTERS[activeFilter];
      return matchesSearch && matchesFilter;
    });
  }, [apps, searchQuery, activeFilter]);

  // Generate dynamic insight
  const insightMessage = useMemo(() => {
    if (apps.length === 0) return 'Start using your phone to see data insights.';

    const categoryTotals = new Map<string, number>();
    for (const app of apps) {
      const cat = categorizeApp(app.packageName);
      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + app.totalBytes);
    }
    let topCategory = 'Other';
    let topCategoryBytes = 0;
    for (const [cat, bytes] of categoryTotals) {
      if (bytes > topCategoryBytes) {
        topCategory = cat;
        topCategoryBytes = bytes;
      }
    }
    const pct = grandTotal > 0 ? Math.round((topCategoryBytes / grandTotal) * 100) : 0;
    return `${topCategory} apps account for ${pct}% of your data usage. ${topCategory === 'Streaming' ? 'Switching to lower quality could save significant data.' : 'Consider restricting background data for less-used apps.'}`;
  }, [apps, grandTotal]);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366F1"
          colors={['#6366F1']}
          progressBackgroundColor={isDark ? '#1A2250' : '#FFFFFF'}
        />
      }>
      {/* ──── Hero Section ──── */}
      <HeroHeader style={{ paddingTop: insets.top + Spacing.four }}>
        <View style={styles.heroTitleRow}>
          <View>
            <Text style={styles.heroTag}>Network Statistics</Text>
            <Text style={styles.heroAppName}>App Breakdown</Text>
          </View>
          <View style={styles.heroActions}>
            <View style={styles.heroAppCount}>
              <Ionicons name="apps" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={styles.heroCountText}>{apps.length} apps</Text>
            </View>
            <ThemeToggle variant="hero" />
          </View>
        </View>

        {/* Stat pills */}
        <View style={styles.statRow}>
          <LinearGradient
            colors={isDark
              ? ['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.05)']
              : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
            style={styles.statPill}>
            <Text style={styles.statLabel}>Total Used</Text>
            <SensitiveValue>
              <Text style={styles.statValue}>{formattedTotal}</Text>
            </SensitiveValue>
          </LinearGradient>
          <LinearGradient
            colors={isDark
              ? ['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)']
              : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
            style={styles.statPill}>
            <Text style={styles.statLabel}>Avg Daily</Text>
            <SensitiveValue>
              <Text style={styles.statValue}>{avgDaily}</Text>
            </SensitiveValue>
          </LinearGradient>
        </View>
      </HeroHeader>

      {/* ──── Content Area ──── */}
      <View style={[styles.contentArea, { marginTop: -Spacing.four }]}>
        {/* Search */}
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search apps..."
        />

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          {FILTERS.map((filter, index) => (
            <FilterChip
              key={filter}
              label={filter}
              selected={activeFilter === index}
              onPress={() => setActiveFilter(index)}
            />
          ))}
        </ScrollView>

        {/* App List */}
        <Card>
          <View style={styles.listHeader}>
            <View style={styles.listTitleRow}>
              <View style={[styles.listDot, { backgroundColor: '#6366F1' }]} />
              <Text style={[styles.listTitle, { color: theme.text }]}>
                {filteredApps.length} Apps
              </Text>
            </View>
            <View style={styles.sortBadge}>
              <Ionicons name="arrow-down" size={12} color={theme.textMuted} />
              <Text style={[styles.sortLabel, { color: theme.textMuted }]}>
                By usage
              </Text>
            </View>
          </View>

          {isLoading ? (
            <SkeletonAppList count={6} />
          ) : filteredApps.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="search-outline" size={32} color={theme.textMuted} />
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>
                {searchQuery ? 'No apps match your search.' : 'No data usage recorded yet.'}
              </Text>
            </View>
          ) : (
            filteredApps.map((app, index) => (
              <React.Fragment key={app.packageName}>
                {index > 0 && (
                  <View
                    style={[
                      styles.separator,
                      { backgroundColor: isDark ? 'rgba(79,89,158,0.12)' : '#F1F5F9' },
                    ]}
                  />
                )}
                <AppUsageRow
                  name={app.appName}
                  subtitle={generateSubtitle(app)}
                  usage={app.formattedTotal}
                  progress={app.relativeUsage}
                  iconColor={APP_COLORS[index % APP_COLORS.length]}
                  iconBase64={app.iconBase64}
                  totalBytes={app.totalBytes}
                />
              </React.Fragment>
            ))
          )}
        </Card>

        {/* Usage Insight */}
        <InsightCard
          title="Usage Insight"
          message={insightMessage}
          accentColor={theme.secondary}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.four,
  },
  heroTag: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroAppName: {
    fontSize: 24,
    fontFamily: Fonts.extraBold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  heroAppCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  heroCountText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.7)',
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statPill: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontFamily: Fonts.numberBold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  contentArea: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  filterRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  listDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  sortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  separator: {
    height: 1,
    marginVertical: Spacing.one,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
});
