import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useThemeMode } from '@/context/ThemeContext';

export type ProgressBarProps = ViewProps & {
  /** Progress value from 0 to 1 */
  progress: number;
  /** Color of the filled bar — defaults to theme secondary (blue) */
  color?: string;
  /** Height of the bar */
  height?: number;
  /** Show track background */
  showTrack?: boolean;
};

/**
 * Themed progress bar with rounded caps.
 * Used for data usage bars in app lists and detail screens.
 * Wrapped in React.memo — only re-renders when props actually change.
 */
export const ProgressBar = React.memo(function ProgressBar({
  progress,
  color,
  height = 6,
  showTrack = true,
  style,
  ...props
}: ProgressBarProps) {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const fillColor = color ?? theme.secondary;
  const trackColor = isDark ? '#25304F' : '#E2E8F0';
  const clampedProgress = Math.max(0, Math.min(1, progress));

  const trackStyle = useMemo(
    () => [
      styles.track,
      { height, borderRadius: height / 2 } as const,
      showTrack && ({ backgroundColor: trackColor } as const),
      style,
    ],
    [height, showTrack, trackColor, style],
  );

  const fillStyle = useMemo(
    () => [
      styles.fill,
      {
        width: `${clampedProgress * 100}%` as const,
        height,
        borderRadius: height / 2,
        backgroundColor: fillColor,
      },
    ],
    [clampedProgress, height, fillColor],
  );

  return (
    <View style={trackStyle} {...props}>
      <View style={fillStyle} />
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
