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

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

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
