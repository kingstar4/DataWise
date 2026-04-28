import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';

export type SegmentedControlProps = ViewProps & {
  /** Array of segment labels */
  segments: string[];
  /** Currently selected index */
  selectedIndex: number;
  /** Selection change handler */
  onSelect: (index: number) => void;
};

/**
 * Premium segmented control with pill-style active indicator.
 * Used for Today/Week/Month selectors.
 */
export function SegmentedControl({
  segments,
  selectedIndex,
  onSelect,
  style,
  ...props
}: SegmentedControlProps) {
  const { isDark } = useThemeMode();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.08)',
        },
        style,
      ]}
      {...props}>
      {segments.map((segment, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Pressable
            key={segment}
            onPress={() => onSelect(index)}
            style={[
              styles.segment,
              isSelected && [
                styles.selectedSegment,
                {
                  backgroundColor: isDark
                    ? 'rgba(79, 89, 158, 0.5)'
                    : 'rgba(255,255,255,0.95)',
                  // elevation: 4,

                },
              ],
            ]}>
            <Text
              style={[
                styles.label,
                {
                  color: isSelected
                    ? '#FFFFFF'
                    : isDark
                      ? 'rgba(255,255,255,0.5)'
                      : 'rgba(255,255,255,0.7)',
                },
                isSelected && !isDark && { color: '#1C2765' },
                isSelected && styles.selectedLabel,
              ]}>
              {segment}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: BorderRadius.md - 2,
  },
  selectedSegment: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    // elevation: 4,

  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  selectedLabel: {
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
    // elevation: 4,
  },
});
