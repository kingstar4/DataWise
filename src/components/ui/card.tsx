import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CardProps = ViewProps & {
  /** Use 'elevated' for shadow/border, 'flat' for no depth */
  variant?: 'elevated' | 'flat';
};

/**
 * Themed card component with rounded corners and depth.
 * Light mode: white surface with soft shadow.
 * Dark mode: dark surface with subtle border.
 */
export function Card({ style, variant = 'elevated', children, ...props }: CardProps) {
  const theme = useTheme();
  const isDark = theme.background === '#0B1020';

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: theme.card },
        variant === 'elevated' && (isDark ? styles.elevatedDark : styles.elevatedLight),
        isDark && variant === 'elevated' && { borderColor: theme.border },
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
  },
  elevatedLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  elevatedDark: {
    borderWidth: 1,
  },
});
