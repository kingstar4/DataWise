import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';

export type StatBoxProps = ViewProps & {
  /** Label text (e.g. "TOTAL USED") */
  label: string;
  /** Value text (e.g. "42.8 GB") */
  value: string;
  /** Optional accent color for value */
  valueColor?: string;
};

/**
 * Stat display box with label and large value.
 * Used in hero headers and summary sections.
 * Wrapped in React.memo — only re-renders when label/value/color change.
 */
export const StatBox = React.memo(function StatBox({
  label,
  value,
  valueColor,
  style,
  ...props
}: StatBoxProps) {
  const { isDark } = useThemeMode();

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        backgroundColor: isDark
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(255,255,255,0.15)',
      },
      style,
    ],
    [isDark, style],
  );

  const valueStyle = useMemo(
    () => [styles.value, valueColor ? { color: valueColor } : null],
    [valueColor],
  );

  return (
    <View style={containerStyle} {...props}>
      <Text style={styles.label}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    alignItems: 'center',
    flex: 1,
    gap: Spacing.one,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
