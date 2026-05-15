import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Card, HeroHeader, InsightCard, ThemeToggle } from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useWalletContext } from '@/context/WalletContext';
import { getMonthlyBundles, normalizeCarrierName } from '@/data/bundles';
import { useTheme } from '@/hooks/use-theme';
import {
  projectMonthlyUsage,
} from '@/hooks/useBundleRecommendation';
import { useDataUsage } from '@/hooks/useDataUsage';
import { supabase } from '@/lib/supabase';
import UsageAccess from '@/native/UsageAccess';
import type { BundlePlan } from '@/types/payments';

// ── Constants ──────────────────────────────────────────────────────────────

const GB = 1024 * 1024 * 1024;

export default function PlanPickerScreen() {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ── Carrier detection ──
  const carrierName = useMemo(() => {
    try {
      const name = UsageAccess.getCarrierName();
      return name || 'Mobile';
    } catch {
      return 'Mobile';
    }
  }, []);

  const carrierId = useMemo(() => normalizeCarrierName(carrierName), [carrierName]);

  // ── Usage projection ──
  const { grandTotal } = useDataUsage('week');
  const projectedMonthlyBytes = useMemo(
    () => projectMonthlyUsage(grandTotal, 'week'),
    [grandTotal],
  );
  const projectedGB = useMemo(
    () => Math.round((projectedMonthlyBytes / GB) * 10) / 10,
    [projectedMonthlyBytes],
  );

  // ── Plans for carrier ──
  const fallbackPlans: BundlePlan[] = useMemo(() => {
    if (!carrierId) return [];
    const monthly = getMonthlyBundles(carrierId);
    // Map to BundlePlan type and take top 3 that are closest to projected usage
    const all = monthly.map((b) => ({
      id: b.id,
      name: b.name,
      gb: b.dataGB,
      price: b.priceNGN,
      validity: b.validityDays,
      ussdCode: b.ussdCode,
      pricePerGb: b.costPerGB,
      network: carrierId,
      cheapDataHubId: b.cheapDataHubId,
    }));
    // Find plans around the projected usage — include plans that cover usage + one below
    const bufferedGB = projectedGB * 1.2;
    const covering = all.filter((p) => p.gb >= bufferedGB);
    const below = all.filter((p) => p.gb < bufferedGB);
    // Take top 2 covering + 1 below (or fill as available)
    const result: BundlePlan[] = [];
    if (covering.length >= 2) {
      result.push(covering[0], covering[1]);
    } else {
      result.push(...covering);
    }
    if (below.length > 0) {
      result.push(below[below.length - 1]); // largest below
    }
    // Fill up to 3 if we don't have enough
    if (result.length < 3) {
      for (const p of all) {
        if (result.length >= 3) break;
        if (!result.find((r) => r.id === p.id)) {
          result.push(p);
        }
      }
    }
    return result.slice(0, 3);
  }, [carrierId, projectedGB]);

  const [livePlans, setLivePlans] = useState<BundlePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!carrierId) {
      setLivePlans([]);
      return;
    }

    let cancelled = false;

    async function loadPlans() {
      setPlansLoading(true);
      setPlansError(null);

      const { data, error } = await supabase.functions.invoke('get-data-plans', {
        body: { network: carrierId, category: 'monthly' },
      });

      if (cancelled) return;

      if (error || data?.status !== 'success') {
        setPlansError(data?.error ?? error?.message ?? 'Could not load live plans');
        setLivePlans([]);
      } else {
        setLivePlans((data.plans ?? []).slice(0, 8));
      }

      setPlansLoading(false);
    }

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, [carrierId]);

  const plans = livePlans.length > 0 ? livePlans : fallbackPlans;

  // ── Best value plan (lowest pricePerGb that covers projected usage) ──
  const bestValueId = useMemo(() => {
    const bufferedGB = projectedGB * 1.2;
    const covering = plans.filter((p) => p.gb >= bufferedGB);
    if (covering.length === 0) return plans[0]?.id ?? null;
    covering.sort((a, b) => a.pricePerGb - b.pricePerGb);
    return covering[0].id;
  }, [plans, projectedGB]);

  // ── Selection state ──
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select best value on first render
  React.useEffect(() => {
    if (bestValueId && selectedId === null) {
      setSelectedId(bestValueId);
    }
  }, [bestValueId, selectedId]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedId) ?? null,
    [plans, selectedId],
  );

  // ── Coverage check ──
  const getStatus = useCallback(
    (plan: BundlePlan): 'covers' | 'short' => {
      return plan.gb >= projectedGB * 1.2 ? 'covers' : 'short';
    },
    [projectedGB],
  );

  // ── Insight message ──
  const insightMessage = useMemo(() => {
    if (!selectedPlan) return '';
    const buffer = selectedPlan.gb - projectedGB;
    if (buffer > 0) {
      return `Your projected usage is ${projectedGB} GB/month. The ${selectedPlan.name} gives you a ${buffer.toFixed(1)} GB buffer at ₦${selectedPlan.pricePerGb}/GB — the best rate for your usage pattern.`;
    }
    return `Your projected usage is ${projectedGB} GB/month. This plan may run short. Consider upgrading for a comfortable buffer.`;
  }, [selectedPlan, projectedGB]);

  const { balance: walletBalance } = useWalletContext();

  // ── Navigation ──
  const handleContinue = useCallback(() => {
    if (!selectedPlan) return;

    const planParams = {
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      planGb: String(selectedPlan.gb),
      planPrice: String(selectedPlan.price),
      planValidity: String(selectedPlan.validity),
      planUssd: selectedPlan.ussdCode,
      planPricePerGb: String(selectedPlan.pricePerGb),
      planNetwork: selectedPlan.network,
      planCheapDataHubId: String(selectedPlan.cheapDataHubId ?? ''),
      carrierName,
      projectedGB: String(projectedGB),
    };

    if (walletBalance >= selectedPlan.price) {
      // Balance is enough — go straight to confirm purchase
      router.push({
        pathname: '/confirm-purchase' as any,
        params: { ...planParams, fundAmount: '0' },
      });
    } else {
      // Balance is insufficient — route to wallet fund first
      router.push({
        pathname: '/wallet-fund' as any,
        params: planParams,
      });
    }
  }, [selectedPlan, router, carrierName, projectedGB, walletBalance]);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}>
      {/* ──── Hero Section ──── */}
      <HeroHeader style={{ paddingTop: insets.top + Spacing.four }}>
        <View style={styles.heroTitleRow}>
          <View>
            <Text style={styles.heroTag}>Projected this month</Text>
            <Text style={styles.heroValue}>{projectedGB} GB</Text>
            <Text style={styles.heroSub}>Based on your last 7 days</Text>
          </View>
          <View style={styles.heroActions}>
            <ThemeToggle variant="hero" />
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        </View>
        <Badge variant="secondary" label={`${carrierName} detected`} />
      </HeroHeader>

      {/* ──── Content Area ──── */}
      <View style={[styles.contentArea, { marginTop: -Spacing.four }]}>
        {/* Section label */}
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
          RECOMMENDED PLANS
        </Text>

        {plansLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#6366F1" />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              Loading live plans...
            </Text>
          </View>
        )}

        {!plansLoading && plansError && (
          <Text style={[styles.fallbackText, { color: theme.textMuted }]}>
            Live prices unavailable. Showing saved plans.
          </Text>
        )}

        {/* Plan cards */}
        {plans.map((plan) => {
          const isSelected = selectedId === plan.id;
          const isBestValue = plan.id === bestValueId;
          const status = getStatus(plan);

          return (
            <Pressable key={plan.id} onPress={() => setSelectedId(plan.id)}>
              <Card
                style={[
                  styles.planCard,
                  isSelected && {
                    borderColor: '#6366F1',
                    borderWidth: 1.5,
                  },
                ]}>
                {/* Best value badge */}
                {isBestValue && (
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>Best value</Text>
                  </View>
                )}

                <View style={styles.planRow}>
                  <View style={styles.planInfo}>
                    <Text style={[styles.planName, { color: theme.text }]}>
                      {plan.gb} GB monthly
                    </Text>
                    <View style={styles.planTags}>
                      <View style={[styles.tagPill, { backgroundColor: isDark ? '#0d1626' : theme.surfaceAlt }]}>
                        <Text style={[styles.tagText, { color: theme.textMuted }]}>{plan.validity} days</Text>
                      </View>
                      <View style={[styles.tagPill, { backgroundColor: isDark ? '#0d1626' : theme.surfaceAlt }]}>
                        <Text style={[styles.tagText, { color: theme.textMuted }]}>
                          ₦{plan.pricePerGb}/GB
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.tagPill,
                          {
                            backgroundColor:
                              status === 'covers'
                                ? (isDark ? '#0a1f18' : '#ecfdf5')
                                : (isDark ? '#1f0a12' : '#fdf2f8'),
                          },
                        ]}>
                        <Text
                          style={[
                            styles.tagText,
                            {
                              color:
                                status === 'covers' ? '#10B981' : '#EC4899',
                            },
                          ]}>
                          {status === 'covers'
                            ? 'covers your usage'
                            : 'may run short'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.planRight}>
                    <Text style={styles.planPrice}>
                      ₦{plan.price.toLocaleString()}
                    </Text>
                    <View
                      style={[
                        styles.radio,
                        isSelected && styles.radioSelected,
                      ]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        })}

        {/* Insight card */}
        {selectedPlan && (
          <InsightCard
            title={`Why ${selectedPlan.gb} GB?`}
            message={insightMessage}
            accentColor="#6366F1"
          />
        )}

        {/* Primary CTA */}
        <Pressable
          onPress={handleContinue}
          disabled={!selectedPlan}
          style={({ pressed }) => [
            styles.ctaButton,
            !selectedPlan && styles.ctaDisabled,
            pressed && selectedPlan && { opacity: 0.85 },
          ]}>
          <Text style={styles.ctaText}>
            {selectedPlan
              ? `Buy ${selectedPlan.gb} GB for ₦${selectedPlan.price.toLocaleString()}`
              : 'Select a plan to continue'}
          </Text>
        </Pressable>

        {/* Ghost button */}
        <Pressable
          onPress={() => router.push('/transactions' as any)}
          style={({ pressed }) => [
            styles.ghostButton,
            { borderColor: theme.border },
            pressed && { opacity: 0.8 },
          ]}>
          <Text style={[styles.ghostText, { color: theme.textMuted }]}>View transaction history</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  heroTag: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 32,
    fontFamily: Fonts.numberBold,
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentArea: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: -Spacing.one,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  fallbackText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginTop: -Spacing.one,
  },
  planCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 16,
    backgroundColor: '#6366F1',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    zIndex: 1,
  },
  bestValueText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planInfo: {
    flex: 1,
    gap: Spacing.two,
  },
  planName: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    letterSpacing: -0.2,
  },
  planTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  tagPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
  },
  planRight: {
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  planPrice: {
    fontSize: 18,
    fontFamily: Fonts.numberBold,
    color: '#6366F1',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#2a3a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#6366F1',
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  ctaButton: {
    backgroundColor: '#6366F1',
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  ghostButton: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: 'rgba(139, 163, 204, 1)',
  },
});
