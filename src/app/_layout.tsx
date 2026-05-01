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
import { Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="plan-picker" />
          <Stack.Screen name="wallet-fund" />
          <Stack.Screen name="confirm-purchase" />
          <Stack.Screen name="purchase-success" />
          <Stack.Screen name="transactions" />
        </Stack>
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

export default function RootLayout() {
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
