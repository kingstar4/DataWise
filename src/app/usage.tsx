import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BarChart,
  Card,
  HeroHeader,
  InsightCard,
  ProgressBar,
  SegmentedControl,
} from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/use-theme';
import { PERIOD_MAP, useDataUsage } from '@/hooks/useDataUsage';

export default function UsageScreen() {
  const theme = useTheme();
  const { isDark, toggle } = useThemeMode();
  const insets = useSafeAreaInsets();
  const [periodIndex, setPeriodIndex] = useState(1);

  const period = PERIOD_MAP[periodIndex];
  const {
    formattedTotal,
    totalMobile,
    totalWifi,
    formattedMobile,
    formattedWifi,
    totalForeground,
    totalBackground,
    formattedForeground,
    formattedBackground,
    grandTotal,
    dailyData,
    peakHours,
    isLoading,
    refetch,
  } = useDataUsage(period);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 800);
  }, [refetch]);

  // Split formatted total for hero display
  const heroDisplay = useMemo(() => {
    const parts = formattedTotal.split(' ');
    return { number: parts[0] || '0', unit: parts[1] || 'B' };
  }, [formattedTotal]);

  // Connectivity ratio
  const connectivityTotal = totalMobile + totalWifi;
  const mobileRatio = connectivityTotal > 0 ? totalMobile / connectivityTotal : 0.5;
  const wifiRatio = connectivityTotal > 0 ? totalWifi / connectivityTotal : 0.5;

  // Foreground/background ratio
  const fgBgTotal = totalForeground + totalBackground;
  const fgRatio = fgBgTotal > 0 ? totalForeground / fgBgTotal : 0.5;
  const bgRatio = fgBgTotal > 0 ? totalBackground / fgBgTotal : 0.5;

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
          <View style={styles.heroTitleLeft}>
            <Ionicons name="analytics" size={18} color="rgba(255,255,255,0.5)" />
            <Text style={styles.heroLabel}>Total Consumption</Text>
          </View>
          <Pressable
            onPress={toggle}
            style={({ pressed }) => [
              styles.themeToggle,
              pressed && { transform: [{ scale: 0.9 }] },
            ]}>
            <Ionicons
              name={isDark ? 'sunny' : 'moon'}
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <View style={styles.heroValueRow}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.heroNumber}>{heroDisplay.number}</Text>
              <Text style={styles.heroUnit}>{heroDisplay.unit}</Text>
            </>
          )}
        </View>

        <SegmentedControl
          segments={['Today', 'Week', 'Month']}
          selectedIndex={periodIndex}
          onSelect={setPeriodIndex}
          style={{ marginBottom: Spacing.four }}
        />

        {dailyData.length > 1 && (
          <BarChart data={dailyData} chartHeight={130} />
        )}
      </HeroHeader>

      {/* ──── Content Area ──── */}
      <View style={[styles.contentArea, { marginTop: -Spacing.four }]}>
        {/* Connectivity Breakdown */}
        <Card>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardTitleDot, { backgroundColor: '#6366F1' }]} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Connectivity Breakdown
            </Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownIconCircle, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
                <Ionicons name="cellular" size={16} color="#6366F1" />
              </View>
              <View>
                <Text style={[styles.breakdownLabel, { color: theme.textMuted }]}>Mobile</Text>
                <Text style={[styles.breakdownValue, { color: theme.text }]}>
                  {formattedMobile}
                </Text>
              </View>
            </View>

            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownIconCircle, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <Ionicons name="wifi" size={16} color="#10B981" />
              </View>
              <View>
                <Text style={[styles.breakdownLabel, { color: theme.textMuted }]}>Wi-Fi</Text>
                <Text style={[styles.breakdownValue, { color: theme.text }]}>
                  {formattedWifi}
                </Text>
              </View>
            </View>
          </View>

          {/* Stacked ratio bar */}
          <View style={styles.ratioBarContainer}>
            <View
              style={[
                styles.ratioBarLeft,
                { flex: mobileRatio, backgroundColor: '#6366F1' },
              ]}
            />
            <View
              style={[
                styles.ratioBarRight,
                { flex: wifiRatio, backgroundColor: '#10B981' },
              ]}
            />
          </View>
          <View style={styles.ratioLabels}>
            <Text style={[styles.ratioLabel, { color: theme.textMuted }]}>
              {Math.round(mobileRatio * 100)}%
            </Text>
            <Text style={[styles.ratioLabel, { color: theme.textMuted }]}>
              {Math.round(wifiRatio * 100)}%
            </Text>
          </View>
        </Card>

        {/* Foreground vs Background */}
        <Card>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardTitleDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              App Activity
            </Text>
          </View>

          <View style={styles.fgBgRow}>
            <View style={styles.fgBgItem}>
              <View style={styles.fgBgHeader}>
                <Ionicons name="phone-portrait-outline" size={14} color="#6366F1" />
                <Text style={[styles.fgBgLabel, { color: theme.textMuted }]}>Foreground</Text>
              </View>
              <Text style={[styles.fgBgValue, { color: theme.text }]}>
                {formattedForeground}
              </Text>
              <ProgressBar
                progress={fgRatio}
                color="#6366F1"
                height={6}
                style={{ marginTop: Spacing.two }}
              />
              <Text style={[styles.fgBgPercent, { color: '#6366F1' }]}>
                {Math.round(fgRatio * 100)}%
              </Text>
            </View>

            <View style={[styles.fgBgDivider, { backgroundColor: isDark ? 'rgba(79,89,158,0.15)' : '#E2E8F0' }]} />

            <View style={styles.fgBgItem}>
              <View style={styles.fgBgHeader}>
                <Ionicons name="moon-outline" size={14} color="#F59E0B" />
                <Text style={[styles.fgBgLabel, { color: theme.textMuted }]}>Background</Text>
              </View>
              <Text style={[styles.fgBgValue, { color: theme.text }]}>
                {formattedBackground}
              </Text>
              <ProgressBar
                progress={bgRatio}
                color="#F59E0B"
                height={6}
                style={{ marginTop: Spacing.two }}
              />
              <Text style={[styles.fgBgPercent, { color: '#F59E0B' }]}>
                {Math.round(bgRatio * 100)}%
              </Text>
            </View>
          </View>
        </Card>

        {/* Peak Usage Windows */}
        <Card>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardTitleDot, { backgroundColor: '#EC4899' }]} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Peak Usage Windows
            </Text>
          </View>

          <View style={styles.peakGrid}>
            {peakHours.map((hour) => {
              const icon = hour.period === 'Morning' ? 'sunny-outline'
                : hour.period === 'Afternoon' ? 'partly-sunny-outline'
                : hour.period === 'Evening' ? 'moon-outline'
                : 'cloudy-night-outline';

              return (
                <LinearGradient
                  key={hour.period}
                  colors={hour.active
                    ? isDark
                      ? ['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.05)']
                      : ['rgba(99,102,241,0.08)', 'rgba(99,102,241,0.02)']
                    : isDark
                      ? ['rgba(18,25,51,0.6)', 'rgba(18,25,51,0.3)']
                      : ['rgba(248,250,252,1)', 'rgba(241,245,249,1)']}
                  style={[
                    styles.peakItem,
                    {
                      borderColor: hour.active
                        ? isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'
                        : isDark ? 'rgba(79,89,158,0.15)' : '#E2E8F0',
                    },
                  ]}>
                  <View style={styles.peakIconRow}>
                    <Ionicons
                      name={icon}
                      size={18}
                      color={hour.active ? '#6366F1' : theme.textMuted}
                    />
                    {hour.active && (
                      <View style={styles.peakBadge}>
                        <Text style={styles.peakBadgeText}>Peak</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.peakPeriod, { color: theme.text }]}>{hour.period}</Text>
                  <Text style={[styles.peakTime, { color: theme.textMuted }]}>{hour.time}</Text>
                  <Text
                    style={[
                      styles.peakUsage,
                      { color: hour.active ? '#6366F1' : theme.text },
                    ]}>
                    {hour.formattedTotal}
                  </Text>
                </LinearGradient>
              );
            })}
          </View>
        </Card>

        {/* Optimizer Insight */}
        <InsightCard
          title="Optimizer Insight"
          message={
            totalMobile > totalWifi
              ? `Mobile data accounts for ${Math.round(mobileRatio * 100)}% of your usage. Switching to Wi-Fi when available could save significant data.`
              : `Great job! Wi-Fi accounts for ${Math.round(wifiRatio * 100)}% of your usage, keeping your mobile data costs low.`
          }
          accentColor="#10B981"
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  heroTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    marginBottom: Spacing.four,
    minHeight: 66,
  },
  heroNumber: {
    fontSize: 56,
    fontFamily: Fonts.numberBold,
    color: '#FFFFFF',
    letterSpacing: -3,
  },
  heroUnit: {
    fontSize: 24,
    fontFamily: Fonts.numberSemiBold,
    color: 'rgba(255,255,255,0.6)',
  },
  contentArea: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  cardTitleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    letterSpacing: -0.2,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  breakdownIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  breakdownValue: {
    fontSize: 17,
    fontFamily: Fonts.numberBold,
  },
  ratioBarContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
  },
  ratioBarLeft: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  ratioBarRight: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  ratioLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  ratioLabel: {
    fontSize: 11,
    fontFamily: Fonts.numberSemiBold,
  },
  fgBgRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  fgBgItem: {
    flex: 1,
  },
  fgBgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  fgBgDivider: {
    width: 1,
  },
  fgBgLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  fgBgValue: {
    fontSize: 20,
    fontFamily: Fonts.numberBold,
    letterSpacing: -0.5,
  },
  fgBgPercent: {
    fontSize: 12,
    fontFamily: Fonts.numberBold,
    marginTop: Spacing.one,
  },
  peakGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  peakItem: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 4,
  },
  peakIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  peakBadge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  peakBadgeText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  peakPeriod: {
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  peakTime: {
    fontSize: 11,
    fontFamily: Fonts.regular,
  },
  peakUsage: {
    fontSize: 17,
    fontFamily: Fonts.numberBold,
    marginTop: 2,
    letterSpacing: -0.3,
  },
});
