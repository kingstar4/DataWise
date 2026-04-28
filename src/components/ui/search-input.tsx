import React from 'react';
import { StyleSheet, Text, TextInput, View, type ViewProps } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SearchInputProps = ViewProps & {
  /** Current value */
  value: string;
  /** Change handler */
  onChangeText: (text: string) => void;
  /** Placeholder text */
  placeholder?: string;
};

/**
 * Themed search input with rounded styling.
 * Used in App Breakdown screen for filtering apps.
 */
export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search apps...',
  style,
  ...props
}: SearchInputProps) {
  const theme = useTheme();
  const isDark = theme.background === '#0B1020';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1A2250' : '#F1F5F9',
          borderColor: isDark ? '#25304F' : '#E2E8F0',
        },
        style,
      ]}
      {...props}>
      <Text style={[styles.searchIcon, { color: theme.textMuted }]}>🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { color: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    gap: Spacing.two,
  },
  searchIcon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    padding: 0,
  },
});
