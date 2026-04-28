import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { palette } from '@/theme/colors';
import { useTheme } from '@/hooks/use-theme';

export type HeroHeaderProps = ViewProps & {
  children: React.ReactNode;
};

/**
 * Navy hero header area used at the top of screens.
 * Provides the deep blue background with padding and safe area support.
 * Cards and content below overlap this via negative margin.
 */
export function HeroHeader({ children, style, ...props }: HeroHeaderProps) {
  const theme = useTheme();
  const isDark = theme.background === '#0B1020';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0D1433' : palette.navy },
        style,
      ]}
      {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five + Spacing.three,
  },
});
