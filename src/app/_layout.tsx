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
import { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import AuthScreen from '@/app/auth';
import OnboardingScreen from '@/app/onboarding';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import NetworkErrorScreen from '@/components/network-error-screen';
import UsagePermissionScreen from '@/components/permission-screen';
import { ThemeProvider, useNavTheme } from '@/context/ThemeContext';
import { SensitiveValuesProvider } from '@/context/SensitiveValuesContext';
import { WalletProvider } from '@/context/WalletContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useUsagePermission } from '@/hooks/useUsagePermission';
import { supabase } from '@/lib/supabase';
import { GoogleSignin } from "@react-native-google-signin/google-signin";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
});

function AppContent() {
  const navTheme = useNavTheme();
  const {
    hasPermission,
    isLoading: permissionLoading,
    onboardingCompleted,
    openSettings,
  } = useUsagePermission();

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasPurchasePin, setHasPurchasePin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
        setAuthLoading(false);
      }
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setSession(session);
          setAuthLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Check profile for purchase PIN whenever session changes
  useEffect(() => {
    if (!session) {
      setHasPurchasePin(false);
      return;
    }

    let mounted = true;
    setProfileLoading(true);

    supabase
      .from('profiles')
      .select('purchase_pin_set')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (mounted) {
          setHasPurchasePin(!!data?.purchase_pin_set);
          setProfileLoading(false);
        }
      });

    return () => { mounted = false; };
  }, [session]);

  // All loading states — show splash
  if (authLoading || permissionLoading || profileLoading) {
    return (
      <NavThemeProvider value={navTheme}>
        <AnimatedSplashOverlay />
      </NavThemeProvider>
    );
  }

  // Not signed in
  if (!session) {
    return (
      <NavThemeProvider value={navTheme}>
        <AuthScreen />
      </NavThemeProvider>
    );
  }

  // Signed in but no purchase PIN yet
  if (!hasPurchasePin) {
    return (
      <NavThemeProvider value={navTheme}>
        <OnboardingScreen onComplete={() => setHasPurchasePin(true)} />
      </NavThemeProvider>
    );
  }

  // Signed in, has purchase PIN, but no usage permission
  if (!hasPermission) {
    return (
      <NavThemeProvider value={navTheme}>
        <UsagePermissionScreen
          onboardingCompleted={onboardingCompleted}
          onOpenSettings={openSettings}
        />
      </NavThemeProvider>
    );
  }

  // All good — main app
  return (
    <NavThemeProvider value={navTheme}>
      <SensitiveValuesProvider>
        <WalletProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="plan-picker" />
            <Stack.Screen name="wallet-fund" />
            <Stack.Screen name="paystack-callback" />
            <Stack.Screen name="confirm-purchase" />
            <Stack.Screen name="purchase-success" />
            <Stack.Screen name="transactions" />
          </Stack>
        </WalletProvider>
      </SensitiveValuesProvider>
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
  const { isChecking, isOnline, refresh } = useNetworkStatus();

  if (!fontsLoaded || isChecking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0B1020',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!isOnline) {
    return <NetworkErrorScreen isChecking={isChecking} onRetry={refresh} />;
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
