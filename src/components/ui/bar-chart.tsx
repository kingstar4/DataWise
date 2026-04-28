import React from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BarChartDataItem = {
  label: string;
  value: number;
  /** Optional: highlight this bar */
  highlighted?: boolean;
};

export type BarChartProps = ViewProps & {
  /** Array of data items */
  data: BarChartDataItem[];
  /** Height of the chart area */
  chartHeight?: number;
  /** Bar color — defaults to theme secondary */
  barColor?: string;
  /** Highlighted bar color */
  highlightColor?: string;
};

/**
 * Simple themed bar chart for data visualization.
 * Used in Usage Details for 7-day usage chart.
 */
export function BarChart({
  data,
  chartHeight = 140,
  barColor,
  highlightColor,
  style,
  ...props
}: BarChartProps) {
  const theme = useTheme();
  const isDark = theme.background === '#0B1020';
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const defaultBarColor = barColor ?? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)');
  const activeColor = highlightColor ?? '#FFFFFF';

  const isCompact = data.length > 10;
  const labelSize = isCompact ? 8 : 11;

  return (
    <View style={[styles.container, { height: chartHeight }, style]} {...props}>
      <View style={[styles.barsContainer, isCompact && { gap: 1, paddingHorizontal: Spacing.one }]}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (chartHeight - 30);
          const isHighlighted = item.highlighted ?? false;

          return (
            <View key={index} style={styles.barGroup}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: isHighlighted ? activeColor : defaultBarColor,
                    borderRadius: BorderRadius.sm / 2,
                  },
                ]}
              />
              <Text
                style={[
                  styles.label,
                  {
                    fontSize: labelSize,
                    color: isHighlighted
                      ? 'rgba(255,255,255,0.9)'
                      : 'rgba(255,255,255,0.5)',
                  },
                  isHighlighted && styles.labelHighlighted,
                ]}
                numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  bar: {
    width: '70%',
    minHeight: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  labelHighlighted: {
    fontWeight: '700',
  },
});
