import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppUsageRow,
  Card,
  FilterChip,
  HeroHeader,
  InsightCard,
  SearchInput,
  StatBox,
} from '@/components/ui';
import { BottomTabInset, BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatBytes, type FormattedAppData, PERIOD_MAP, useDataUsage } from '@/hooks/useDataUsage';

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
  '#4F599E', '#E1306C', '#FF0000', '#25D366', '#1DB954',
  '#1877F2', '#FF6900', '#7C3AED', '#0EA5E9', '#F59E0B',
];

export default function BreakdownScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.background === '#0B1020';
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(0);

  // Default to "week" period for the breakdown view
  const { apps, formattedTotal, grandTotal, isLoading } = useDataUsage('week');

  // Compute average daily
  const avgDaily = useMemo(() => {
    const days = 7; // week view
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

    // Find top category by total bytes
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
      contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}>
      {/* ──── Hero Section ──── */}
      <HeroHeader style={{ paddingTop: insets.top + Spacing.four }}>
        <View style={styles.heroTitleRow}>
          <Text style={styles.heroAppName}>DataWise</Text>
          <Text style={styles.heroTag}>NETWORK STATISTICS</Text>
        </View>

        <Text style={styles.heroSectionLabel}>App Usage</Text>

        <View style={styles.statRow}>
          <StatBox label="TOTAL USED" value={formattedTotal} />
          <View style={{ width: Spacing.two }} />
          <StatBox label="AVG DAILY" value={avgDaily} />
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
            <Text style={[styles.listTitle, { color: theme.text }]}>
              {filteredApps.length} Apps
            </Text>
            <Text style={[styles.sortLabel, { color: theme.textMuted }]}>
              By usage ↓
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.secondary} />
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>
                Loading app data…
              </Text>
            </View>
          ) : filteredApps.length === 0 ? (
            <View style={styles.loadingContainer}>
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
                      { backgroundColor: isDark ? '#25304F' : '#F1F5F9' },
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
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  heroAppName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroTag: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroSectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: Spacing.three,
  },
  statRow: {
    flexDirection: 'row',
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
    marginBottom: Spacing.two,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    marginVertical: Spacing.one,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
