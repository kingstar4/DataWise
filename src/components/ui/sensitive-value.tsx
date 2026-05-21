import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useSensitiveValues } from '@/context/SensitiveValuesContext';

export type SensitiveValueProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
};

/**
 * Shared privacy toggle for wallet and data totals.
 * Keeps the placeholder inside this shared component so every screen hides
 * values the same way without depending on native blur support.
 */
export function SensitiveValue({
  children,
  style,
  contentStyle,
  overlayStyle,
}: SensitiveValueProps) {
  const { toggleValuesHidden, valuesHidden } = useSensitiveValues();

  return (
    <Pressable
      accessibilityHint="Toggles wallet balance and data usage visibility across the app"
      accessibilityLabel={valuesHidden ? 'Show sensitive values' : 'Hide sensitive values'}
      accessibilityRole="button"
      onPress={toggleValuesHidden}
      style={({ pressed }) => [
        styles.pressable,
        style,
        pressed && styles.pressed,
      ]}>
      <View
        pointerEvents="none"
        style={[styles.content, contentStyle, valuesHidden && styles.hiddenContent]}>
        {children}
      </View>
      {valuesHidden && (
        <View
          pointerEvents="none"
          style={[styles.placeholder, overlayStyle]}>
          <Text style={styles.placeholderText}>••••••</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    minWidth: 42,
    overflow: 'hidden',
    position: 'relative',
  },
  pressed: {
    opacity: 0.86,
  },
  content: {
    minHeight: 18,
  },
  hiddenContent: {
    opacity: 0,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
  },
});
