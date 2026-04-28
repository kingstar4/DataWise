import React from 'react';
import { Pressable, StyleSheet, Text, type ViewProps } from 'react-native';

import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/use-theme';

export type FilterChipProps = ViewProps & {
  /** Chip label */
  label: string;
  /** Whether the chip is currently selected */
  selected?: boolean;
  /** onPress handler */
  onPress?: () => void;
};

/**
 * Themed filter chip for toggling categories.
 * Used in App Breakdown for filtering by app type.
 */
export function FilterChip({
  label,
  selected = false,
  onPress,
  style,
  ...props
}: FilterChipProps) {
  const theme = useTheme();
  const { isDark } = useThemeMode();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        selected
          ? {
            backgroundColor: isDark ? '#293a97ff' : theme.primary,
          }
          : {
            backgroundColor: isDark ? '#1A2250' : '#F1F5F9',
            borderWidth: 1,
            borderColor: isDark ? '#25304F' : '#E2E8F0',
          },
        pressed && styles.pressed,
        style as any,
      ]}
      {...props}>
      <Text
        style={[
          styles.label,
          {
            color: selected
              ? '#FFFFFF'
              : isDark
                ? '#E2E8F0'
                : '#64748B',
          },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
  pressed: {
    opacity: 0.8,
  },
});
