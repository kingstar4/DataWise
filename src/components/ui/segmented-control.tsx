import React, { useCallback, useMemo } from 'react';
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
 * Wrapped in React.memo — only re-renders when segments/selectedIndex change.
 */
export const SegmentedControl = React.memo(function SegmentedControl({
  segments,
  selectedIndex,
  onSelect,
  style,
  ...props
}: SegmentedControlProps) {
  const { isDark } = useThemeMode();

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        backgroundColor: isDark
          ? 'rgba(255,255,255,0.06)'
          : 'rgba(0,0,0,0.08)',
      },
      style,
    ],
    [isDark, style],
  );

  return (
    <View style={containerStyle} {...props}>
      {segments.map((segment, index) => (
        <SegmentButton
          key={segment}
          label={segment}
          index={index}
          isSelected={index === selectedIndex}
          isDark={isDark}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
});

/** Individual segment button — memoized to avoid re-rendering unselected segments */
const SegmentButton = React.memo(function SegmentButton({
  label,
  index,
  isSelected,
  isDark,
  onSelect,
}: {
  label: string;
  index: number;
  isSelected: boolean;
  isDark: boolean;
  onSelect: (index: number) => void;
}) {
  const handlePress = useCallback(() => onSelect(index), [onSelect, index]);

  const segmentStyle = useMemo(
    () => [
      styles.segment,
      isSelected && [
        styles.selectedSegment,
        {
          backgroundColor: isDark
            ? 'rgba(79, 89, 158, 0.5)'
            : 'rgba(255,255,255,0.95)',
        },
      ],
    ],
    [isSelected, isDark],
  );

  const textStyle = useMemo(
    () => [
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
    ],
    [isSelected, isDark],
  );

  return (
    <Pressable onPress={handlePress} style={segmentStyle}>
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
});

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
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  selectedLabel: {
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
  },
});
