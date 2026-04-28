/**
 * Theme constants for DataWise.
 * Colors are sourced from the design system in src/theme/themes.ts.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { lightTheme, darkTheme } from '@/theme/themes';

export const Colors = {
  light: {
    ...lightTheme,
    text: lightTheme.text,
    textMuted: lightTheme.textMuted,
    background: lightTheme.background,
    backgroundElement: lightTheme.surfaceAlt,
    backgroundSelected: lightTheme.border,
    textSecondary: lightTheme.textMuted,
  },
  dark: {
    ...darkTheme,
    text: darkTheme.text,
    textMuted: darkTheme.textMuted,
    background: darkTheme.background,
    backgroundElement: darkTheme.surfaceAlt,
    backgroundSelected: darkTheme.border,
    textSecondary: darkTheme.textMuted,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Font family names — must match the keys used in useFonts() in _layout.tsx.
 *
 * Plus Jakarta Sans: body text, labels, UI elements
 * Space Grotesk: numbers, metrics, data displays
 *
 * On Android, fontWeight doesn't work with custom fonts.
 * Each weight must be its own fontFamily.
 */
export const Fonts = {
  // Plus Jakarta Sans — body
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',

  // Space Grotesk — numbers / metrics
  numberRegular: 'SpaceGrotesk_400Regular',
  numberMedium: 'SpaceGrotesk_500Medium',
  numberSemiBold: 'SpaceGrotesk_600SemiBold',
  numberBold: 'SpaceGrotesk_700Bold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
