import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';

export type HeroHeaderProps = ViewProps & {
  children: React.ReactNode;
};

/**
 * Premium gradient hero header area used at the top of screens.
 * Dark: deep indigo → midnight blue gradient.
 * Light: vibrant navy → royal purple gradient.
 * Features a smooth convex curved bottom edge for a modern aesthetic.
 */
export function HeroHeader({ children, style, ...props }: HeroHeaderProps) {
  const { isDark } = useThemeMode();

  const gradientColors = isDark
    ? ['#0F1B3D', '#162050', '#1A2760'] as const
    : ['#1C2765', '#2D3A8C', '#4338CA'] as const;

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
      {...props}>
      {/* Subtle glass overlay */}
      <View style={styles.glassOverlay} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five + Spacing.four,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,

  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});
