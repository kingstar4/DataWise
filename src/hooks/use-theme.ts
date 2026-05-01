/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useMemo } from 'react';

import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';

/**
 * Returns the current theme color palette.
 * Memoized so consumers only re-render when the mode actually changes.
 */
export function useTheme() {
  const { mode } = useThemeMode();
  // Colors.light and Colors.dark are static objects so this is stable
  // per mode value, preventing child re-renders from new references.
  return useMemo(() => Colors[mode], [mode]);
}
