import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { palette } from '@/theme/colors';
import { useThemeMode } from '@/context/ThemeContext';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

export type BadgeProps = ViewProps & {
  variant?: BadgeVariant;
  /** Text content — pass as children for custom content */
  label?: string;
};

/**
 * Themed badge/chip component for status indicators, labels, etc.
 * Wrapped in React.memo — only re-renders when variant/label change.
 */
export const Badge = React.memo(function Badge({
  style,
  variant = 'primary',
  label,
  children,
  ...props
}: BadgeProps) {
  const { isDark } = useThemeMode();

  const variantStyles = useMemo(
    () => getVariantStyles(variant, isDark),
    [variant, isDark],
  );

  const containerStyle = useMemo(
    () => [styles.base, variantStyles.container, style],
    [variantStyles.container, style],
  );

  return (
    <View style={containerStyle} {...props}>
      {label ? (
        <Text style={[styles.text, { color: variantStyles.textColor }]}>
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );
});

function getVariantStyles(variant: BadgeVariant, isDark: boolean) {
  const map: Record<BadgeVariant, { container: object; textColor: string }> = {
    primary: {
      container: { backgroundColor: isDark ? '#1A2250' : palette.navy },
      textColor: '#FFFFFF',
    },
    secondary: {
      container: { backgroundColor: isDark ? '#25304F' : '#EEF2FF' },
      textColor: isDark ? '#BBC3FF' : palette.navy,
    },
    success: {
      container: { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' },
      textColor: isDark ? '#6EE7B7' : '#065F46',
    },
    warning: {
      container: { backgroundColor: isDark ? '#78350F' : '#FFFBEB' },
      textColor: isDark ? '#FCD34D' : '#92400E',
    },
    danger: {
      container: { backgroundColor: isDark ? '#7F1D1D' : '#FEF2F2' },
      textColor: isDark ? '#FCA5A5' : '#991B1B',
    },
    info: {
      container: { backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF' },
      textColor: isDark ? '#93C5FD' : '#1E40AF',
    },
    muted: {
      container: { backgroundColor: isDark ? '#25304F' : '#F1F5F9' },
      textColor: isDark ? '#CBD5E1' : '#64748B',
    },
  };
  return map[variant];
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.one + 2,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.3,
  },
});
