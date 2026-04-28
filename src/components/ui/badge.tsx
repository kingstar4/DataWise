import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { palette } from '@/theme/colors';
import { useTheme } from '@/hooks/use-theme';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

export type BadgeProps = ViewProps & {
  variant?: BadgeVariant;
  /** Text content — pass as children for custom content */
  label?: string;
};

/**
 * Themed badge/chip component for status indicators, labels, etc.
 */
export function Badge({ style, variant = 'primary', label, children, ...props }: BadgeProps) {
  const theme = useTheme();
  const isDark = theme.background === '#0B1020';

  const variantStyles = getVariantStyles(variant, isDark);

  return (
    <View style={[styles.base, variantStyles.container, style]} {...props}>
      {label ? (
        <View>
          <BadgeText color={variantStyles.textColor}>{label}</BadgeText>
        </View>
      ) : (
        children
      )}
    </View>
  );
}

function BadgeText({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View>
      <View>
        {React.Children.map(children, (child) => {
          if (typeof child === 'string') {
            const Text = require('react-native').Text;
            return <Text style={[styles.text, { color }]}>{child}</Text>;
          }
          return child;
        })}
      </View>
    </View>
  );
}

function getVariantStyles(variant: BadgeVariant, isDark: boolean) {
  const styles: Record<BadgeVariant, { container: object; textColor: string }> = {
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
  return styles[variant];
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
