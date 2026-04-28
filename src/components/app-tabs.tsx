import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { palette } from '@/theme/colors';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const isDark = scheme === 'dark';
  const activeTint = isDark ? '#FFFFFF' : palette.navy;
  const inactiveTint = colors.textMuted;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: isDark ? '#1A2250' : '#E2E8F0',
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 64 : 88,
          paddingBottom: Platform.OS === 'android' ? 10 : 28,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="usage"
        options={{
          title: 'Usage',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="breakdown"
        options={{
          title: 'Apps',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="apps" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
