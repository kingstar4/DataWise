import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemeMode } from '@/context/ThemeContext';

export type InsightCardProps = ViewProps & {
  /** Title text for the insight */
  title: string;
  /** Body message */
  message: string;
  /** Optional icon name (Material Icons name) */
  icon?: string;
  /** Accent color for the gradient border */
  accentColor?: string;
};

/**
 * Premium insight card with gradient accent strip and icon.
 * Used for Quick Insights on Home, Optimizer Insights on Usage Details, etc.
 * Wrapped in React.memo — only re-renders when title/message/accent changes.
 */
export const InsightCard = React.memo(function InsightCard({
  title,
  message,
  icon,
  accentColor,
  style,
  ...props
}: InsightCardProps) {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const accent = accentColor ?? theme.secondary;

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        backgroundColor: isDark ? 'rgba(18, 25, 51, 0.8)' : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(79, 89, 158, 0.2)' : accent + '30',
      },
      !isDark && styles.lightShadow,
      style,
    ],
    [isDark, accent, style],
  );

  const gradientColors = useMemo(
    () => [accent, isDark ? '#7C3AED' : '#4338CA'] as const,
    [accent, isDark],
  );

  const iconCircleStyle = useMemo(
    () => [styles.iconCircle, { backgroundColor: accent + '20' }],
    [accent],
  );

  const iconName = title.includes('Quick') ? 'flash' : 'bulb';

  return (
    <View style={containerStyle} {...props}>
      {/* Gradient accent strip */}
      <LinearGradient
        colors={gradientColors}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={styles.accentStrip}
      />
      <View style={styles.contentWrap}>
        <View style={styles.header}>
          <View style={iconCircleStyle}>
            <Ionicons name={iconName} size={16} color={accent} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        </View>
        <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>
      </View>
    </View>
  );
});

const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 0, y: 1 } as const;

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  lightShadow: {
    shadowColor: '#1C2765',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 5,
  },
  accentStrip: {
    width: 4,
  },
  contentWrap: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Fonts.regular,
  },
});
