import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import UsagePermissionScreen from '@/components/permission-screen';
import { useUsagePermission } from '@/hooks/useUsagePermission';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { hasPermission, isLoading, onboardingCompleted, openSettings } =
    useUsagePermission();

  // While we're still checking permission + loading onboarding flag,
  // keep the splash visible (don't flash the wrong screen).
  if (isLoading) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {hasPermission ? (
        // ── Permission granted → show the main app ──
        <AppTabs />
      ) : (
        // ── Permission not granted → show the permission screen ──
        // The screen adjusts its copy based on whether this is
        // first-time onboarding or a revoked-permission scenario.
        <UsagePermissionScreen
          onboardingCompleted={onboardingCompleted}
          onOpenSettings={openSettings}
        />
      )}
    </ThemeProvider>
  );
}
