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
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import AuthScreen from '@/app/auth';
import OnboardingScreen from '@/app/onboarding';
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

SplashScreen.preventAutoHideAsync().catch(() => {
  // The native splash may already be hidden during fast refresh.
});

const STARTUP_REQUEST_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Startup request timed out'));
    }, timeoutMs);

    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

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
  const [profileStatus, setProfileStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const {
          data: { session },
        } = await withTimeout(
          supabase.auth.getSession(),
          STARTUP_REQUEST_TIMEOUT_MS,
        );
        if (mounted) {
          setSession(session);
        }
      } catch (error) {
        console.warn('Session startup load failed:', error);
        if (mounted) {
          setSession(null);
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
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
      setProfileStatus('idle');
      return;
    }

    let mounted = true;
    setProfileStatus('loading');

    withTimeout(
      supabase
        .from('profiles')
        .select('purchase_pin_set')
        .eq('user_id', session.user.id)
        .single(),
      STARTUP_REQUEST_TIMEOUT_MS,
    )
      .then(({ data }) => {
        if (mounted) {
          setHasPurchasePin(!!data?.purchase_pin_set);
        }
      })
      .catch((error) => {
        console.warn('Profile startup load failed:', error);
        if (mounted) {
          setHasPurchasePin(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setProfileStatus('ready');
        }
      });

    return () => { mounted = false; };
  }, [session]);

  // All loading states — show splash
  const startupLoading =
    authLoading ||
    permissionLoading ||
    (!!session && profileStatus !== 'ready');

  const hideSplashAfterLayout = useCallback(() => {
    if (startupLoading || splashHidden) {
      return;
    }

    SplashScreen.hideAsync()
      .catch(() => {
        // The splash may already be hidden during development reloads.
      })
      .finally(() => setSplashHidden(true));
  }, [splashHidden, startupLoading]);

  if (startupLoading) {
    return null;
  }

  // Not signed in
  if (!session) {
    return (
      <View style={styles.appRoot} onLayout={hideSplashAfterLayout}>
        <NavThemeProvider value={navTheme}>
          <AuthScreen />
        </NavThemeProvider>
      </View>
    );
  }

  // Signed in but no purchase PIN yet
  if (!hasPurchasePin) {
    return (
      <View style={styles.appRoot} onLayout={hideSplashAfterLayout}>
        <NavThemeProvider value={navTheme}>
          <OnboardingScreen onComplete={() => setHasPurchasePin(true)} />
        </NavThemeProvider>
      </View>
    );
  }

  // Signed in, has purchase PIN, but no usage permission
  if (Platform.OS === 'android' && !hasPermission) {
    return (
      <View style={styles.appRoot} onLayout={hideSplashAfterLayout}>
        <NavThemeProvider value={navTheme}>
          <UsagePermissionScreen
            onboardingCompleted={onboardingCompleted}
            onOpenSettings={openSettings}
          />
        </NavThemeProvider>
      </View>
    );
  }

  // All good — main app
  return (
    <View style={styles.appRoot} onLayout={hideSplashAfterLayout}>
      <NavThemeProvider value={navTheme}>
        <SensitiveValuesProvider>
          <WalletProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="plan-picker" />
              <Stack.Screen name="wallet-fund" />
              <Stack.Screen name="paystack-callback" />
              <Stack.Screen name="flutterwave-callback" />
              <Stack.Screen name="confirm-purchase" />
              <Stack.Screen name="purchase-success" />
              <Stack.Screen name="transactions" />
            </Stack>
          </WalletProvider>
        </SensitiveValuesProvider>
      </NavThemeProvider>
    </View>
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
  const [offlineSplashHidden, setOfflineSplashHidden] = useState(false);

  const hideOfflineSplashAfterLayout = useCallback(() => {
    if (!fontsLoaded || isChecking || isOnline || offlineSplashHidden) {
      return;
    }

    SplashScreen.hideAsync()
      .catch(() => {
        // The splash may already be hidden during development reloads.
      })
      .finally(() => setOfflineSplashHidden(true));
  }, [fontsLoaded, isChecking, isOnline, offlineSplashHidden]);

  useEffect(() => {
    if (isOnline) {
      setOfflineSplashHidden(false);
    }
  }, [isOnline]);

  useEffect(() => {
    return () => {
      SplashScreen.hideAsync().catch(() => {
        // Avoid leaving the native splash visible during fast-refresh teardown.
      });
    };
  }, []);

  if (!fontsLoaded || isChecking) {
    return null;
  }

  if (!isOnline) {
    return (
      <View style={styles.appRoot} onLayout={hideOfflineSplashAfterLayout}>
        <NetworkErrorScreen isChecking={isChecking} onRetry={refresh} />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
});
