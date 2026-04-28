import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BarChart,
  Card,
  HeroHeader,
  InsightCard,
  ProgressBar,
  SegmentedControl,
} from '@/components/ui';
import { BottomTabInset, BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatBytes, PERIOD_MAP, useDataUsage } from '@/hooks/useDataUsage';

export default function UsageScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.background === '#0B1020';
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
  } = useDataUsage(period);

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
      contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}>
      {/* ──── Hero Section ──── */}
      <HeroHeader style={{ paddingTop: insets.top + Spacing.four }}>
        <Text style={styles.heroLabel}>Total Consumption</Text>

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
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Connectivity Breakdown
          </Text>

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <View style={styles.breakdownDot}>
                <View style={[styles.dot, { backgroundColor: '#4F599E' }]} />
              </View>
              <View>
                <Text style={[styles.breakdownLabel, { color: theme.textMuted }]}>Mobile</Text>
                <Text style={[styles.breakdownValue, { color: theme.text }]}>
                  {formattedMobile}
                </Text>
              </View>
            </View>

            <View style={styles.breakdownItem}>
              <View style={styles.breakdownDot}>
                <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
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
                {
                  flex: mobileRatio,
                  backgroundColor: '#4F599E',
                },
              ]}
            />
            <View
              style={[
                styles.ratioBarRight,
                {
                  flex: wifiRatio,
                  backgroundColor: '#10B981',
                },
              ]}
            />
          </View>
        </Card>

        {/* Foreground vs Background */}
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Background vs Foreground
          </Text>

          <View style={styles.fgBgRow}>
            <View style={styles.fgBgItem}>
              <Text style={[styles.fgBgLabel, { color: theme.textMuted }]}>Foreground</Text>
              <Text style={[styles.fgBgValue, { color: theme.text }]}>
                {formattedForeground}
              </Text>
              <ProgressBar
                progress={fgRatio}
                color="#4F599E"
                height={8}
                style={{ marginTop: Spacing.two }}
              />
            </View>

            <View style={styles.fgBgItem}>
              <Text style={[styles.fgBgLabel, { color: theme.textMuted }]}>Background</Text>
              <Text style={[styles.fgBgValue, { color: theme.text }]}>
                {formattedBackground}
              </Text>
              <ProgressBar
                progress={bgRatio}
                color="#F59E0B"
                height={8}
                style={{ marginTop: Spacing.two }}
              />
            </View>
          </View>
        </Card>

        {/* Peak Usage Windows */}
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Peak Usage Windows
          </Text>

          <View style={styles.peakGrid}>
            {peakHours.map((hour) => (
              <View
                key={hour.period}
                style={[
                  styles.peakItem,
                  {
                    backgroundColor: hour.active
                      ? isDark
                        ? '#1A2250'
                        : '#EEF2FF'
                      : isDark
                        ? '#121933'
                        : '#F8FAFC',
                    borderColor: hour.active
                      ? isDark
                        ? '#4F599E'
                        : '#C7D2FE'
                      : isDark
                        ? '#25304F'
                        : '#E2E8F0',
                  },
                ]}>
                <Text style={[styles.peakPeriod, { color: theme.text }]}>{hour.period}</Text>
                <Text style={[styles.peakTime, { color: theme.textMuted }]}>{hour.time}</Text>
                <Text
                  style={[
                    styles.peakUsage,
                    {
                      color: hour.active ? theme.secondary : theme.text,
                    },
                  ]}>
                  {hour.formattedTotal}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Optimizer Insight */}
        <InsightCard
          title="Optimizer Insight"
          message={
            totalMobile > totalWifi
              ? `Mobile data accounts for ${Math.round(mobileRatio * 100)}% of your usage. Switching to Wi-Fi when available could save significant data.`
              : `Good job! Wi-Fi accounts for ${Math.round(wifiRatio * 100)}% of your usage, keeping your mobile data costs low.`
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
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.two,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    marginBottom: Spacing.four,
    minHeight: 62,
  },
  heroNumber: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  heroUnit: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  contentArea: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: Spacing.three,
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
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  dot: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  ratioBarContainer: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2,
  },
  ratioBarLeft: {
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },
  ratioBarRight: {
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  fgBgRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  fgBgItem: {
    flex: 1,
  },
  fgBgLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: Spacing.one,
  },
  fgBgValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  peakGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  peakItem: {
    width: '48%',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
    flexGrow: 1,
    flexBasis: '45%',
  },
  peakPeriod: {
    fontSize: 14,
    fontWeight: '600',
  },
  peakTime: {
    fontSize: 11,
    fontWeight: '400',
  },
  peakUsage: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: Spacing.one,
  },
});
