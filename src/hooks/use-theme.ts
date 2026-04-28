/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';

export function useTheme() {
  const { mode } = useThemeMode();
  return Colors[mode];
}
