import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppUsageRow,
  Badge,
  Card,
  HeroHeader,
  InsightCard,
  SegmentedControl,
} from '@/components/ui';
import { BottomTabInset, BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PERIOD_MAP, useDataUsage } from '@/hooks/useDataUsage';
import UsageAccess from '@/native/UsageAccess';

// Rotating palette for dynamically colored app icons
const APP_COLORS = [
  '#4F599E', '#E1306C', '#FF0000', '#25D366', '#1DB954',
  '#1877F2', '#FF6900', '#7C3AED', '#0EA5E9', '#F59E0B',
];

const PERIOD_LABELS = ['today', 'this week', 'this month'];

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.background === '#0B1020';
  const [periodIndex, setPeriodIndex] = useState(1);
  const [showAllDrainers, setShowAllDrainers] = useState(false);

  // Get actual carrier name from native Android TelephonyManager
  const carrierName = useMemo(() => {
    try {
      const name = UsageAccess.getCarrierName();
      return name || 'Mobile';
    } catch {
      return 'Mobile';
    }
  }, []);

  // Fetch real data usage from the native module
  const period = PERIOD_MAP[periodIndex];
  const {
    apps,
    formattedTotal,
    totalBackground,
    grandTotal,
    isLoading,
  } = useDataUsage(period);

  // Split formatted total into number and unit for the hero display
  const heroDisplay = useMemo(() => {
    const parts = formattedTotal.split(' ');
    return { number: parts[0] || '0', unit: parts[1] || 'B' };
  }, [formattedTotal]);

  // All data drainers (mapped for display)
  const allDrainers = useMemo(() => {
    return apps.map((app, index) => ({
      name: app.appName,
      usage: app.formattedTotal,
      progress: app.relativeUsage,
      color: APP_COLORS[index % APP_COLORS.length],
      iconBase64: app.iconBase64,
      totalBytes: app.totalBytes,
    }));
  }, [apps]);

  // Show 4 initially, or all when expanded
  const visibleDrainers = showAllDrainers ? allDrainers : allDrainers.slice(0, 4);

  // Dynamic insight based on real data
  const insightMessage = useMemo(() => {
    if (apps.length === 0) return 'No data usage recorded yet for this period.';
    const bgPercent = grandTotal > 0 ? Math.round((totalBackground / grandTotal) * 100) : 0;
    const topApp = apps[0]?.appName ?? 'Unknown';
    const topUsage = apps[0]?.formattedTotal ?? '0 B';
    if (bgPercent > 30) {
      return `Background usage accounts for ${bgPercent}% of your total data. ${topApp} is your top data consumer at ${topUsage}.`;
    }
    return `${topApp} is your biggest data consumer at ${topUsage}. Your background usage is well controlled at ${bgPercent}%.`;
  }, [apps, totalBackground, grandTotal]);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}>
      {/* ──── Hero Section ──── */}
      <HeroHeader style={{ paddingTop: insets.top + Spacing.four }}>
        <View style={styles.heroGreeting}>
          <Text style={styles.greetingText}>Good Morning, User</Text>
          <View style={styles.settingsCircle}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </View>
        </View>

        <View style={styles.heroDataBlock}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.heroNumber}>{heroDisplay.number}</Text>
              <Text style={styles.heroUnit}>{heroDisplay.unit}</Text>
            </>
          )}
        </View>

        <View style={styles.heroMeta}>
          <Badge variant="secondary" label={carrierName} />
          <Text style={styles.heroSubtext}>
            Total data used {PERIOD_LABELS[periodIndex]}
          </Text>
        </View>

        <SegmentedControl
          segments={['Today', 'Week', 'Month']}
          selectedIndex={periodIndex}
          onSelect={setPeriodIndex}
          style={styles.segmentedControl}
        />
      </HeroHeader>

      {/* ──── Content Area ──── */}
      <View style={[styles.contentArea, { marginTop: -Spacing.four }]}>
        {/* Quick Insight */}
        <InsightCard
          title="Quick Insight"
          message={insightMessage}
          accentColor={theme.warning}
        />

        {/* Top Drainers */}
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Top Drainers
            </Text>
            {allDrainers.length > 4 && (
              <Pressable onPress={() => setShowAllDrainers((prev) => !prev)}>
                <Text style={[styles.seeAll, { color: theme.secondary }]}>
                  {showAllDrainers ? 'Show Less' : 'See All'}
                </Text>
              </Pressable>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.secondary} />
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>
                Loading usage data…
              </Text>
            </View>
          ) : visibleDrainers.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>
                No data usage recorded yet.
              </Text>
            </View>
          ) : (
            visibleDrainers.map((app, index) => (
              <React.Fragment key={app.name}>
                {index > 0 && (
                  <View
                    style={[
                      styles.separator,
                      { backgroundColor: isDark ? '#25304F' : '#F1F5F9' },
                    ]}
                  />
                )}
                <AppUsageRow
                  name={app.name}
                  usage={app.usage}
                  progress={app.progress}
                  iconColor={app.color}
                  iconBase64={app.iconBase64}
                  totalBytes={app.totalBytes}
                />
              </React.Fragment>
            ))
          )}
        </Card>

        {/* Recommended Bundle */}
        <Card style={[styles.bundleCard, { backgroundColor: isDark ? '#0D1433' : '#1C2765' }]}>
          <View style={styles.bundleHeader}>
            <Text style={styles.bundleLabel}>Recommended Bundle</Text>
            <Badge variant="success" label="Save ₦1,200" />
          </View>
          <Text style={styles.bundleName}>MTN SME Data 10GB</Text>
          <View style={styles.bundleMeta}>
            <Text style={styles.bundlePrice}>₦2,500</Text>
            <Text style={styles.bundleValidity}>30 days validity</Text>
          </View>
          <View style={styles.bundleAction}>
            <View style={styles.bundleButton}>
              <Text style={styles.bundleButtonText}>View Bundle</Text>
            </View>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  heroGreeting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  greetingText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
  },
  settingsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  heroDataBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    marginBottom: Spacing.two,
    minHeight: 66,
  },
  heroNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  heroUnit: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  heroSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '400',
  },
  segmentedControl: {
    marginTop: Spacing.two,
  },
  contentArea: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    marginVertical: Spacing.one,
  },
  bundleCard: {
    padding: Spacing.four,
  },
  bundleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  bundleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bundleName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: Spacing.two,
  },
  bundleMeta: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  bundlePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bundleValidity: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '400',
  },
  bundleAction: {
    alignItems: 'flex-start',
  },
  bundleButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderRadius: BorderRadius.full,
  },
  bundleButtonText: {
    color: '#1C2765',
    fontSize: 14,
    fontWeight: '700',
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
