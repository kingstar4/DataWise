import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemeMode } from '@/context/ThemeContext';

export type CardProps = ViewProps & {
  /** Use 'elevated' for shadow/border, 'flat' for no depth */
  variant?: 'elevated' | 'flat';
};

/**
 * Glassmorphism-styled card component.
 * Light mode: white with soft shadow and subtle border.
 * Dark mode: frosted glass effect with translucent background.
 */
export function Card({ style, variant = 'elevated', children, ...props }: CardProps) {
  const theme = useTheme();
  const { isDark } = useThemeMode();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: isDark
            ? 'rgba(18, 25, 51, 0.85)'
            : 'rgba(255, 255, 255, 0.92)',
        },
        variant === 'elevated' && (isDark ? styles.elevatedDark : styles.elevatedLight),
        isDark && variant === 'elevated' && {
          borderColor: 'rgba(79, 89, 158, 0.2)',
        },
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.three + 4,
  },
  elevatedLight: {
    shadowColor: '#1C2765',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
  },
  elevatedDark: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
});
