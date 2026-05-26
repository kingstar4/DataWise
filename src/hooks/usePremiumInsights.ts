import { useCallback, useEffect, useMemo, useState } from 'react';

import { ALL_BUNDLES, normalizeCarrierName } from '@/data/bundles';
import { supabase } from '@/lib/supabase';
import type {
  ActiveBundle,
  DataBudget,
  PhoneNumberProfile,
  PremiumInsights,
  PremiumRecommendation,
} from '@/types/premium';

type TransactionRow = {
  id: string;
  amount: number;
  status: string;
  type: string;
  plan_name: string | null;
  created_at: string;
  metadata?: Record<string, any> | null;
};

type PremiumState = PremiumInsights & {
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  saveBudget: (amount: number) => Promise<void>;
  savePhoneNumber: (params: {
    label: string;
    phoneNumber: string;
    network: string;
    isDefault?: boolean;
  }) => Promise<void>;
  saveManualCheckin: (params: {
    phoneNumberId?: string | null;
    bundlePurchaseId?: string | null;
    remainingGb: number;
  }) => Promise<void>;
};

const DEFAULT_MONTHLY_BUDGET = 5000;

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthStart(monthKey: string) {
  return `${monthKey}-01T00:00:00.000Z`;
}

function addDays(dateIso: string, days: number) {
  const date = new Date(dateIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function daysBetween(fromIso: string, toIso: string) {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.ceil((to - from) / (24 * 60 * 60 * 1000));
}

function inferBundle(row: TransactionRow) {
  const metadata = row.metadata ?? {};
  const cheapDataHubId = Number(metadata.cheap_datahub_id ?? 0);
  const byProviderId = cheapDataHubId
    ? ALL_BUNDLES.find((bundle) => bundle.cheapDataHubId === cheapDataHubId)
    : undefined;
  const byName = ALL_BUNDLES.find((bundle) =>
    row.plan_name?.toLowerCase().includes(bundle.name.toLowerCase()),
  );
  const bundle = byProviderId ?? byName;
  const amountNgn = Math.round(row.amount / 100);

  return {
    network: metadata.network ?? bundle?.carrier ?? normalizeCarrierName(row.plan_name ?? '') ?? null,
    dataGb: bundle?.dataGB ?? Number(metadata.data_gb ?? metadata.gb ?? 0),
    validityDays: bundle?.validityDays ?? Number(metadata.validity_days ?? 30),
    phoneNumber: metadata.phone_number ? String(metadata.phone_number) : null,
    amount: amountNgn,
  };
}

function mapPhoneNumber(row: Record<string, any>): PhoneNumberProfile {
  return {
    id: row.id,
    label: row.label ?? 'Personal',
    phoneNumber: row.phone_number,
    network: row.network,
    isDefault: !!row.is_default,
  };
}

function mapBudget(row: Record<string, any> | null): DataBudget | null {
  if (!row) return null;
  return {
    id: row.id,
    month: row.month,
    amount: Math.round(Number(row.amount ?? 0) / 100),
  };
}

function buildRecommendations(params: {
  budget: DataBudget | null;
  monthlySpend: number;
  monthlyGb: number;
  averagePricePerGb: number | null;
  activeBundles: ActiveBundle[];
  purchaseRows: TransactionRow[];
  phoneNumbers: PhoneNumberProfile[];
}) {
  const {
    budget,
    monthlySpend,
    monthlyGb,
    averagePricePerGb,
    activeBundles,
    purchaseRows,
    phoneNumbers,
  } = params;
  const budgetAmount = budget?.amount ?? DEFAULT_MONTHLY_BUDGET;
  const recommendations: PremiumRecommendation[] = [];

  if (monthlySpend >= budgetAmount * 0.8) {
    recommendations.push({
      id: 'budget-watch',
      type: 'budget',
      title: 'Budget watch',
      message: `You have used ${Math.round((monthlySpend / budgetAmount) * 100)}% of your ₦${budgetAmount.toLocaleString()} monthly data budget.`,
      priority: monthlySpend > budgetAmount ? 'high' : 'medium',
    });
  }

  const expiring = activeBundles
    .map((bundle) => ({
      ...bundle,
      daysLeft: daysBetween(new Date().toISOString(), bundle.expiresAt),
    }))
    .filter((bundle) => bundle.daysLeft >= 0 && bundle.daysLeft <= 3)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  if (expiring) {
    recommendations.push({
      id: 'expiry-reminder',
      type: 'expiry',
      title: 'Expiry reminder',
      message: `${expiring.planName} expires ${expiring.daysLeft === 0 ? 'today' : `in ${expiring.daysLeft} day${expiring.daysLeft === 1 ? '' : 's'}`}.`,
      priority: expiring.daysLeft <= 1 ? 'high' : 'medium',
    });
  }

  if (averagePricePerGb && monthlyGb > 0) {
    const matchingCarrier = normalizeCarrierName(activeBundles[0]?.network ?? '') ?? 'MTN';
    const betterBundle = ALL_BUNDLES
      .filter((bundle) => bundle.carrier === matchingCarrier && bundle.dataGB >= 1)
      .sort((a, b) => a.costPerGB - b.costPerGB)
      .find((bundle) => bundle.costPerGB < averagePricePerGb);

    if (betterBundle) {
      recommendations.push({
        id: 'better-value',
        type: 'value',
        title: 'Better value available',
        message: `${betterBundle.name} is about ₦${betterBundle.costPerGB.toLocaleString()}/GB, below your current ₦${Math.round(averagePricePerGb).toLocaleString()}/GB average.`,
        priority: 'medium',
      });
    }
  }

  if (purchaseRows.length >= 3) {
    const sorted = [...purchaseRows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const gaps = sorted.slice(1).map((row, index) =>
      daysBetween(sorted[index].created_at, row.created_at),
    );
    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

    if (averageGap > 0 && averageGap < 14) {
      recommendations.push({
        id: 'repeat-purchase',
        type: 'repeat_purchase',
        title: 'Repeat purchase pattern',
        message: `You usually buy data every ${Math.round(averageGap)} days. A longer-validity bundle may reduce repeat top-ups.`,
        priority: 'low',
      });
    }
  }

  if (phoneNumbers.length === 0) {
    recommendations.push({
      id: 'add-number',
      type: 'multi_number',
      title: 'Save your numbers',
      message: 'Save personal, family, or business numbers so DataWise can track spend and expiry separately.',
      priority: 'low',
    });
  }

  recommendations.push({
    id: 'manual-checkin',
    type: 'manual_checkin',
    title: 'Manual balance check-in',
    message: 'On iOS, update your remaining data after purchase to improve reminders and next-plan suggestions.',
    priority: 'low',
  });

  return recommendations.slice(0, 5);
}

const emptyInsights: PremiumInsights = {
  monthKey: getMonthKey(),
  budget: null,
  monthlySpend: 0,
  monthlyGb: 0,
  averagePricePerGb: null,
  purchaseCount: 0,
  activeBundles: [],
  phoneNumbers: [],
  recommendations: [],
};

async function fetchMonthlyTransactions(userId: string, monthStart: string) {
  const baseQuery = supabase
    .from('transactions')
    .select('id, amount, status, type, plan_name, created_at, metadata')
    .eq('user_id', userId)
    .eq('status', 'success')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false });

  const withMetadata = await baseQuery;
  if (!withMetadata.error) return withMetadata;

  const message = String(withMetadata.error.message ?? '').toLowerCase();
  const metadataColumnMissing =
    withMetadata.error.code === 'PGRST204' ||
    (message.includes('metadata') && message.includes('schema cache')) ||
    (message.includes('column') && message.includes('metadata'));

  if (!metadataColumnMissing) return withMetadata;

  const fallback = await supabase
    .from('transactions')
    .select('id, amount, status, type, plan_name, created_at')
    .eq('user_id', userId)
    .eq('status', 'success')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false });

  return {
    ...fallback,
    data: fallback.data?.map((row) => ({ ...row, metadata: null })),
  };
}

export function usePremiumInsights(): PremiumState {
  const [insights, setInsights] = useState<PremiumInsights>(emptyInsights);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setInsights(emptyInsights);
      setLoading(false);
      return;
    }

    const monthKey = getMonthKey();
    const monthStart = getMonthStart(monthKey);

    const [budgetResult, phoneResult, transactionResult] = await Promise.all([
      supabase
        .from('data_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', monthKey)
        .maybeSingle(),
      supabase
        .from('phone_numbers')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false }),
      fetchMonthlyTransactions(user.id, monthStart),
    ]);

    const tableMissing =
      budgetResult.error?.code === '42P01' ||
      phoneResult.error?.code === '42P01' ||
      transactionResult.error?.code === '42P01';

    if (tableMissing) {
      setError('Premium tables are not deployed yet.');
    } else if (budgetResult.error || phoneResult.error || transactionResult.error) {
      console.warn('Premium insights load error:', {
        budget: budgetResult.error,
        phone: phoneResult.error,
        transactions: transactionResult.error,
      });
      setError('Failed to load premium insights.');
    }

    const phoneNumbers = (phoneResult.data ?? []).map(mapPhoneNumber);
    const purchaseRows = ((transactionResult.data ?? []) as TransactionRow[]).filter(
      (row) => row.type !== 'wallet_topup',
    );

    const activeBundles: ActiveBundle[] = purchaseRows.map((row) => {
      const inferred = inferBundle(row);
      const expiresAt = addDays(row.created_at, inferred.validityDays);
      const status = new Date(expiresAt).getTime() >= Date.now() ? 'active' : 'expired';

      return {
        id: row.id,
        transactionId: row.id,
        phoneNumberId: null,
        phoneNumber: inferred.phoneNumber,
        network: inferred.network,
        planName: row.plan_name ?? 'Data bundle',
        amount: inferred.amount,
        dataGb: inferred.dataGb,
        validityDays: inferred.validityDays,
        purchasedAt: row.created_at,
        expiresAt,
        status,
      };
    });

    const monthlySpend = purchaseRows.reduce((sum, row) => sum + Math.round(row.amount / 100), 0);
    const monthlyGb = activeBundles.reduce((sum, bundle) => sum + bundle.dataGb, 0);
    const averagePricePerGb = monthlyGb > 0 ? monthlySpend / monthlyGb : null;
    const budget = mapBudget(budgetResult.data ?? null);
    const liveBundles = activeBundles.filter((bundle) => bundle.status === 'active');

    setInsights({
      monthKey,
      budget,
      monthlySpend,
      monthlyGb,
      averagePricePerGb,
      purchaseCount: purchaseRows.length,
      activeBundles: liveBundles,
      phoneNumbers,
      recommendations: buildRecommendations({
        budget,
        monthlySpend,
        monthlyGb,
        averagePricePerGb,
        activeBundles: liveBundles,
        purchaseRows,
        phoneNumbers,
      }),
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const saveBudget = useCallback(async (amount: number) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const month = getMonthKey();
    const { error: saveErr } = await supabase.from('data_budgets').upsert(
      {
        user_id: user.id,
        month,
        amount: Math.round(amount * 100),
      },
      { onConflict: 'user_id,month' },
    );
    if (saveErr) throw saveErr;
    await fetchInsights();
  }, [fetchInsights]);

  const savePhoneNumber = useCallback(async (params: {
    label: string;
    phoneNumber: string;
    network: string;
    isDefault?: boolean;
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const network = normalizeCarrierName(params.network);
    const { error: saveErr } = await supabase.from('phone_numbers').upsert(
      {
        user_id: user.id,
        label: params.label || 'Personal',
        phone_number: params.phoneNumber.replace(/\D/g, ''),
        network,
        is_default: params.isDefault ?? false,
      },
      { onConflict: 'user_id,phone_number' },
    );
    if (saveErr) throw saveErr;
    await fetchInsights();
  }, [fetchInsights]);

  const saveManualCheckin = useCallback(async (params: {
    phoneNumberId?: string | null;
    bundlePurchaseId?: string | null;
    remainingGb: number;
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: saveErr } = await supabase.from('usage_checkins').insert({
      user_id: user.id,
      phone_number_id: params.phoneNumberId ?? null,
      bundle_purchase_id: params.bundlePurchaseId ?? null,
      remaining_gb: params.remainingGb,
      source: 'manual',
    });
    if (saveErr) throw saveErr;
    await fetchInsights();
  }, [fetchInsights]);

  return useMemo(
    () => ({
      ...insights,
      loading,
      error,
      refetch: fetchInsights,
      saveBudget,
      savePhoneNumber,
      saveManualCheckin,
    }),
    [error, fetchInsights, insights, loading, saveBudget, saveManualCheckin, savePhoneNumber],
  );
}
