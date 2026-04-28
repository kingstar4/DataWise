import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { BorderRadius } from '@/constants/theme';
import { palette } from '@/theme/colors';
import { useTheme } from '@/hooks/use-theme';

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
 */
export function ProgressBar({
  progress,
  color,
  height = 6,
  showTrack = true,
  style,
  ...props
}: ProgressBarProps) {
  const theme = useTheme();
  const isDark = theme.background === '#0B1020';
  const fillColor = color ?? theme.secondary;
  const trackColor = isDark ? '#25304F' : '#E2E8F0';
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2 },
        showTrack && { backgroundColor: trackColor },
        style,
      ]}
      {...props}>
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress * 100}%`,
            height,
            borderRadius: height / 2,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
}

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
