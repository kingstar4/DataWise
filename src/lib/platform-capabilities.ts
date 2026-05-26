import { Platform } from 'react-native';

export type PlatformCapabilities = {
  automaticUsageTracking: boolean;
  manualUsageTracking: boolean;
  purchaseAnalytics: boolean;
  expiryReminders: boolean;
  multiNumberManagement: boolean;
  bundleRecommendations: boolean;
};

export const platformCapabilities: PlatformCapabilities = {
  automaticUsageTracking: Platform.OS === 'android',
  manualUsageTracking: true,
  purchaseAnalytics: true,
  expiryReminders: true,
  multiNumberManagement: true,
  bundleRecommendations: true,
};

export function getUsageInsightSource(hasUsagePermission: boolean) {
  if (platformCapabilities.automaticUsageTracking && hasUsagePermission) {
    return 'android_native' as const;
  }

  return 'purchase_history' as const;
}
