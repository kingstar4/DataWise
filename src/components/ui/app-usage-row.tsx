import React from 'react';
import { Image, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { ProgressBar } from './progress-bar';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ── Usage-based color thresholds ──
const MB = 1024 * 1024;
const USAGE_COLOR_GREEN = '#10B981';  // 0 - 100 MB
const USAGE_COLOR_YELLOW = '#F59E0B'; // 100 MB - 500 MB
const USAGE_COLOR_RED = '#EF4444';    // 500 MB+

function getUsageColor(totalBytes?: number): string {
  if (totalBytes == null || totalBytes <= 100 * MB) return USAGE_COLOR_GREEN;
  if (totalBytes <= 500 * MB) return USAGE_COLOR_YELLOW;
  return USAGE_COLOR_RED;
}

export type AppUsageRowProps = ViewProps & {
  /** App name */
  name: string;
  /** Usage amount string, e.g. "12.4 GB" */
  usage: string;
  /** Progress value 0-1 */
  progress: number;
  /** Subtitle/category text */
  subtitle?: string;
  /** Custom icon background color (fallback when no icon) */
  iconColor?: string;
  /** Override bar color — if not set, uses usage-based color */
  barColor?: string;
  /** Base64-encoded PNG of the app icon */
  iconBase64?: string;
  /** Total bytes for this app (used for color thresholds) */
  totalBytes?: number;
};

/**
 * App usage list item with real icon (or letter fallback), name, usage amount,
 * and a color-coded progress bar (green/yellow/red based on consumption).
 */
export function AppUsageRow({
  name,
  usage,
  progress,
  subtitle,
  iconColor,
  barColor,
  iconBase64,
  totalBytes,
  style,
  ...props
}: AppUsageRowProps) {
  const theme = useTheme();
  const bgColor = iconColor ?? theme.secondary;
  const usageColor = barColor ?? getUsageColor(totalBytes);
  const hasIcon = iconBase64 != null && iconBase64.length > 0;

  return (
    <View style={[styles.container, style]} {...props}>
      {hasIcon ? (
        <Image
          source={{ uri: `data:image/png;base64,${iconBase64}` }}
          style={styles.iconImage}
        />
      ) : (
        <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
          <Text style={styles.iconLetter}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.nameColumn}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {name}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          <Text style={[styles.usage, { color: theme.text }]}>{usage}</Text>
        </View>

        <ProgressBar progress={progress} color={usageColor} height={5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
  },
  iconLetter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameColumn: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
  },
  usage: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.two,
  },
});
