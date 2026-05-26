import type { CarrierId } from '@/data/bundles';

export type PhoneNumberProfile = {
  id: string;
  label: string;
  phoneNumber: string;
  network: CarrierId | null;
  isDefault: boolean;
};

export type DataBudget = {
  id: string;
  month: string;
  amount: number;
};

export type UsageCheckinSource = 'manual' | 'android_native';

export type UsageCheckin = {
  id: string;
  phoneNumberId: string | null;
  bundlePurchaseId: string | null;
  remainingGb: number;
  source: UsageCheckinSource;
  checkedAt: string;
};

export type ActiveBundle = {
  id: string;
  transactionId: string | null;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  network: string | null;
  planName: string;
  amount: number;
  dataGb: number;
  validityDays: number;
  purchasedAt: string;
  expiresAt: string;
  status: 'active' | 'expired';
};

export type PremiumRecommendationType =
  | 'budget'
  | 'expiry'
  | 'value'
  | 'repeat_purchase'
  | 'manual_checkin'
  | 'multi_number';

export type PremiumRecommendation = {
  id: string;
  type: PremiumRecommendationType;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
};

export type PremiumInsights = {
  monthKey: string;
  budget: DataBudget | null;
  monthlySpend: number;
  monthlyGb: number;
  averagePricePerGb: number | null;
  purchaseCount: number;
  activeBundles: ActiveBundle[];
  phoneNumbers: PhoneNumberProfile[];
  recommendations: PremiumRecommendation[];
};
