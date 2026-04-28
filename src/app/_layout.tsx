import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import UsagePermissionScreen from '@/components/permission-screen';
import { ThemeProvider, useNavTheme } from '@/context/ThemeContext';
import { useUsagePermission } from '@/hooks/useUsagePermission';

function AppContent() {
  const navTheme = useNavTheme();
  const { hasPermission, isLoading, onboardingCompleted, openSettings } =
    useUsagePermission();

  // While we're still checking permission + loading onboarding flag,
  // keep the splash visible (don't flash the wrong screen).
  if (isLoading) {
    return (
      <NavThemeProvider value={navTheme}>
        <AnimatedSplashOverlay />
      </NavThemeProvider>
    );
  }

  return (
    <NavThemeProvider value={navTheme}>
      <AnimatedSplashOverlay />
      {hasPermission ? (
        // ── Permission granted → show the main app ──
        <AppTabs />
      ) : (
        // ── Permission not granted → show the permission screen ──
        <UsagePermissionScreen
          onboardingCompleted={onboardingCompleted}
          onOpenSettings={openSettings}
        />
      )}
    </NavThemeProvider>
  );
}

export default function TabLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // Show a minimal loading state while fonts load
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B1020', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
