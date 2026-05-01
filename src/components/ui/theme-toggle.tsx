import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { useThemeMode } from '@/context/ThemeContext';

export type ThemeToggleProps = {
  /** Size of the icon (default 18) */
  size?: number;
  /** Visual variant of the button */
  variant?: 'hero' | 'surface';
  /** Extra style overrides */
  style?: ViewStyle;
};

/**
 * Reusable theme toggle button.
 *
 * - `hero` variant: semi-transparent white for use on gradient hero headers
 * - `surface` variant: adapts to current theme for use on card/page surfaces
 *
 * Wrapped in React.memo — only re-renders when isDark changes.
 */
export const ThemeToggle = React.memo(function ThemeToggle({
  size = 18,
  variant = 'hero',
  style,
}: ThemeToggleProps) {
  const { isDark, toggle } = useThemeMode();

  const buttonStyle = useMemo(() => {
    if (variant === 'hero') {
      return {
        backgroundColor: 'rgba(255,255,255,0.1)' as const,
        borderColor: 'rgba(255,255,255,0.15)' as const,
      };
    }
    return {
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.1)'
        : ('rgba(0,0,0,0.06)' as const),
      borderColor: isDark
        ? 'rgba(255,255,255,0.15)'
        : ('rgba(0,0,0,0.08)' as const),
    };
  }, [isDark, variant]);

  const iconColor = useMemo(() => {
    if (variant === 'hero') return '#FFFFFF';
    return isDark ? '#FFFFFF' : '#374151';
  }, [isDark, variant]);

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [
        styles.button,
        buttonStyle,
        style,
        pressed && styles.pressed,
      ]}>
      <Ionicons name={isDark ? 'sunny' : 'moon'} size={size} color={iconColor} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.9 }],
  },
});
