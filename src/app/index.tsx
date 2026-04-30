import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppUsageRow,
  Badge,
  Card,
  HeroHeader,
  InsightCard,
  SegmentedControl,
  SkeletonHeroValue,
  SkeletonAppList,
} from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/use-theme';
import {
  projectMonthlyUsage,
  useBundleRecommendation,
} from '@/hooks/useBundleRecommendation';
import { PERIOD_MAP, useDataUsage } from '@/hooks/useDataUsage';
import UsageAccess from '@/native/UsageAccess';
import { dialUSSD } from '@/utils/dial-ussd';

// Rotating palette for dynamically colored app icons
const APP_COLORS = [
  '#6366F1', '#EC4899', '#EF4444', '#10B981', '#14B8A6',
  '#3B82F6', '#F97316', '#8B5CF6', '#06B6D4', '#F59E0B',
];

const PERIOD_LABELS = ['today', 'this week', 'this month'];

export default function HomeScreen() {
  const theme = useTheme();
  const { isDark, toggle } = useThemeMode();
  const insets = useSafeAreaInsets();
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
    refetch,
  } = useDataUsage(period);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    // Brief delay so the spinner doesn't flash
    setTimeout(() => setRefreshing(false), 800);
  }, [refetch]);

  // Split formatted total into number and unit for the hero display
  const heroDisplay = useMemo(() => {
    const parts = formattedTotal.split(' ');
    return { number: parts[0] || '0', unit: parts[1] || 'B' };
  }, [formattedTotal]);

  // ── Bundle recommendation ──
  const projectedMonthly = useMemo(
    () => projectMonthlyUsage(grandTotal, period),
    [grandTotal, period],
  );
  const recommendation = useBundleRecommendation(carrierName, projectedMonthly);

  const handleBuyBundle = useCallback(() => {
    if (recommendation) {
      dialUSSD(recommendation.bundle.ussdCode, recommendation.bundle.name);
    }
  }, [recommendation]);

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

  // Dynamic greeting based on current time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
  }, []);

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
        <View style={styles.heroGreeting}>
          <View>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.appName}>DataWise</Text>
          </View>
          {/* Theme Toggle Button */}
          <Pressable
            onPress={toggle}
            style={({ pressed }) => [
              styles.themeToggle,
              pressed && { transform: [{ scale: 0.9 }] },
            ]}>
            <Ionicons
              name={isDark ? 'sunny' : 'moon'}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <View style={styles.heroDataBlock}>
          {isLoading ? (
            <SkeletonHeroValue />
          ) : (
            <View style={styles.heroValueWrap}>
              <Text style={styles.heroNumber}>{heroDisplay.number}</Text>
              <Text style={styles.heroUnit}>{heroDisplay.unit}</Text>
            </View>
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
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: '#6366F1' }]} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Top Drainers
              </Text>
            </View>
            {allDrainers.length > 4 && (
              <Pressable
                onPress={() => setShowAllDrainers((prev) => !prev)}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                <Text style={[styles.seeAll, { color: '#6366F1' }]}>
                  {showAllDrainers ? 'Show Less' : 'See All'}
                </Text>
              </Pressable>
            )}
          </View>

          {isLoading ? (
            <SkeletonAppList count={4} />
          ) : visibleDrainers.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="cellular-outline" size={32} color={theme.textMuted} />
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
                      { backgroundColor: isDark ? 'rgba(79,89,158,0.15)' : '#F1F5F9' },
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

        {/* Recommended Bundle — dynamic */}
        {recommendation && (
          <LinearGradient
            colors={isDark
              ? ['#1A1F4E', '#252B6A']
              : ['#2D3A8C', '#4338CA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bundleCard}>
            <View style={styles.bundleHeader}>
              <View style={styles.bundleLabelRow}>
                <Ionicons name="diamond" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.bundleLabel}>Recommended Bundle</Text>
              </View>
              {recommendation.savingsNGN > 0 && (
                <Badge
                  variant="success"
                  label={`Save ₦${recommendation.savingsNGN.toLocaleString()}`}
                />
              )}
            </View>
            <Text style={styles.bundleName}>{recommendation.bundle.name}</Text>
            <View style={styles.bundleMeta}>
              <Text style={styles.bundlePrice}>
                ₦{recommendation.bundle.priceNGN.toLocaleString()}
              </Text>
              <Text style={styles.bundleValidity}>
                {recommendation.bundle.validityDays} days validity
              </Text>
            </View>
            <View style={styles.bundleFooter}>
              <Text style={styles.bundleProjection}>
                Based on ~{recommendation.projectedUsageGB.toFixed(1)} GB/mo usage
              </Text>
              <Pressable
                onPress={handleBuyBundle}
                style={({ pressed }) => [
                  styles.bundleButton,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}>
                <Text style={styles.bundleButtonText}>Buy Bundle</Text>
                <Ionicons name="call" size={14} color="#1C2765" />
              </Pressable>
            </View>
          </LinearGradient>
        )}
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
    alignItems: 'flex-start',
    marginBottom: Spacing.four,
  },
  greetingText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginBottom: 2,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDataBlock: {
    marginBottom: Spacing.two,
    minHeight: 72,
    justifyContent: 'center',
  },
  heroValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  heroNumber: {
    fontSize: 60,
    fontFamily: Fonts.numberBold,
    color: '#FFFFFF',
    letterSpacing: -3,
  },
  heroUnit: {
    fontSize: 26,
    fontFamily: Fonts.numberSemiBold,
    color: 'rgba(255,255,255,0.6)',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  heroSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Fonts.regular,
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
    marginBottom: Spacing.three,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  separator: {
    height: 1,
    marginVertical: Spacing.one,
  },
  bundleCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.four,
    overflow: 'hidden',
  },
  bundleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  bundleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  bundleLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bundleName: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: '#FFFFFF',
    marginBottom: Spacing.two,
    letterSpacing: -0.5,
  },
  bundleMeta: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.four,
    alignItems: 'center',
  },
  bundlePrice: {
    fontSize: 18,
    fontFamily: Fonts.numberBold,
    color: '#FFFFFF',
  },
  bundleValidity: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: Fonts.regular,
  },
  bundleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bundleProjection: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.4)',
    flex: 1,
  },
  bundleButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three + 4,
    paddingVertical: Spacing.two + 2,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  bundleButtonText: {
    color: '#1C2765',
    fontSize: 13,
    fontFamily: Fonts.bold,
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
