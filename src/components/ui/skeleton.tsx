import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewProps } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';

/* ─────────────────────── Base Skeleton Box ─────────────────────── */

export type SkeletonBoxProps = ViewProps & {
  /** Width of the skeleton element */
  width: number | `${number}%`;
  /** Height of the skeleton element */
  height: number;
  /** Border radius (default: md) */
  radius?: number;
};

/**
 * Animated shimmer skeleton placeholder.
 * Pulses between two opacities for a smooth loading effect.
 */
export function SkeletonBox({
  width,
  height,
  radius = BorderRadius.md,
  style,
  ...props
}: SkeletonBoxProps) {
  const { isDark } = useThemeMode();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: isDark
            ? 'rgba(79, 89, 158, 0.25)'
            : 'rgba(148, 163, 184, 0.2)',
          opacity,
        },
        style,
      ]}
      {...props}
    />
  );
}

/* ───────────────── Pre-composed Skeleton Layouts ───────────────── */

/**
 * Matches the HeroHeader data display (large number + unit).
 * For use inside the hero section while data loads.
 */
export function SkeletonHeroValue() {
  return (
    <View style={skeletonStyles.heroRow}>
      <SkeletonBox width={120} height={56} radius={BorderRadius.lg} />
      <SkeletonBox width={40} height={24} radius={BorderRadius.sm} />
    </View>
  );
}

/**
 * Matches an AppUsageRow layout — icon + name/subtitle + usage + progress bar.
 */
export function SkeletonAppRow() {

  return (
    <View style={skeletonStyles.appRow}>
      {/* Icon placeholder */}
      <SkeletonBox width={40} height={40} radius={BorderRadius.sm} />

      {/* Content area */}
      <View style={skeletonStyles.appRowContent}>
        <View style={skeletonStyles.appRowTop}>
          <View style={skeletonStyles.appRowNameCol}>
            <SkeletonBox width="70%" height={14} radius={6} />
            <SkeletonBox width="45%" height={10} radius={4} />
          </View>
          <SkeletonBox width={50} height={14} radius={6} />
        </View>
        <SkeletonBox width="100%" height={5} radius={3} />
      </View>
    </View>
  );
}

/**
 * A list of skeleton app rows with separators, for use inside a Card.
 */
export function SkeletonAppList({ count = 4 }: { count?: number }) {
  const { isDark } = useThemeMode();

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <View
              style={[
                skeletonStyles.separator,
                {
                  backgroundColor: isDark
                    ? 'rgba(79,89,158,0.15)'
                    : '#F1F5F9',
                },
              ]}
            />
          )}
          <SkeletonAppRow />
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * Generic card content skeleton — a few lines of varying widths.
 * Useful for insight cards, stat sections, etc.
 */
export function SkeletonCardContent({ lines = 3 }: { lines?: number }) {
  const widths: (`${number}%`)[] = ['90%', '75%', '60%', '85%', '50%'];

  return (
    <View style={skeletonStyles.cardContent}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          width={widths[i % widths.length]}
          height={12}
          radius={6}
        />
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  appRowContent: {
    flex: 1,
    gap: Spacing.two,
  },
  appRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appRowNameCol: {
    flex: 1,
    gap: 4,
  },
  separator: {
    height: 1,
    marginVertical: Spacing.one,
  },
  cardContent: {
    gap: Spacing.two + 2,
  },
});
