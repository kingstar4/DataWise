import React from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type InsightCardProps = ViewProps & {
  /** Title text for the insight */
  title: string;
  /** Body message */
  message: string;
  /** Optional icon name (Material Icons name) */
  icon?: string;
  /** Accent color for the left border/icon */
  accentColor?: string;
};

/**
 * Themed insight/recommendation card with accent border.
 * Used for Quick Insights on Home, Optimizer Insights on Usage Details, etc.
 */
export function InsightCard({
  title,
  message,
  icon,
  accentColor,
  style,
  ...props
}: InsightCardProps) {
  const theme = useTheme();
  const isDark = theme.background === '#0B1020';
  const accent = accentColor ?? theme.secondary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surfaceAlt,
          borderLeftColor: accent,
        },
        isDark && { borderColor: theme.border, borderWidth: 1, borderLeftWidth: 3 },
        style,
      ]}
      {...props}>
      <View style={styles.header}>
        {icon && (
          <Text style={[styles.icon, { color: accent }]}>{icon}</Text>
        )}
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      </View>
      <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  icon: {
    fontSize: 20,
    fontFamily: 'Material Icons',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
});
