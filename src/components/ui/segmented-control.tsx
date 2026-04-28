import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentedControlProps = ViewProps & {
  /** Array of segment labels */
  segments: string[];
  /** Currently selected index */
  selectedIndex: number;
  /** Selection change handler */
  onSelect: (index: number) => void;
};

/**
 * Themed segmented control / toggle for time periods.
 * Used for Today/Week/Month selectors.
 */
export function SegmentedControl({
  segments,
  selectedIndex,
  onSelect,
  style,
  ...props
}: SegmentedControlProps) {
  const theme = useTheme();
  const isDark = theme.background === '#0B1020';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)' },
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
                { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.95)' },
              ],
            ]}>
            <Text
              style={[
                styles.label,
                {
                  color: isSelected
                    ? isDark
                      ? '#FFFFFF'
                      : '#1C2765'
                    : 'rgba(255,255,255,0.6)',
                },
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
    borderRadius: BorderRadius.sm,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm - 2,
  },
  selectedSegment: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  selectedLabel: {
    fontWeight: '700',
  },
});
