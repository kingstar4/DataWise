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
import UsagePermissionScreen from '@/components/permission-screen';
import { ThemeProvider, useNavTheme } from '@/context/ThemeContext';
import { WalletProvider } from '@/context/WalletContext';
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
  const [hasPhone, setHasPhone] = useState(false);
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

  // Check profile for phone number whenever session changes
  useEffect(() => {
    if (!session) {
      setHasPhone(false);
      return;
    }

    let mounted = true;
    setProfileLoading(true);

    supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (mounted) {
          setHasPhone(!!data?.phone_number);
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

  // Signed in but no phone number yet
  if (!hasPhone) {
    return (
      <NavThemeProvider value={navTheme}>
        <OnboardingScreen onComplete={() => setHasPhone(true)} />
      </NavThemeProvider>
    );
  }

  // Signed in, has phone, but no usage permission
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
      <WalletProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="plan-picker" />
          <Stack.Screen name="wallet-fund" />
          <Stack.Screen name="confirm-purchase" />
          <Stack.Screen name="purchase-success" />
          <Stack.Screen name="transactions" />
        </Stack>
      </WalletProvider>
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

  if (!fontsLoaded) {
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

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}