import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Card, HeroHeader, InsightCard, SensitiveValue, ThemeToggle } from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useWalletContext } from '@/context/WalletContext';
import { getBundlesForCarrier, getMonthlyBundles, normalizeCarrierName, type CarrierId } from '@/data/bundles';
import { useTheme } from '@/hooks/use-theme';
import {
  projectMonthlyUsage,
} from '@/hooks/useBundleRecommendation';
import { useDataUsage } from '@/hooks/useDataUsage';
import { supabase } from '@/lib/supabase';
import UsageAccess from '@/native/UsageAccess';
import type { BundlePlan } from '@/types/payments';
import { platformCapabilities } from '@/lib/platform-capabilities';

// ── Constants ──────────────────────────────────────────────────────────────

const GB = 1024 * 1024 * 1024;
const ALL_PLANS_BATCH_SIZE = 8;
const NETWORK_CHOICES: CarrierId[] = ['MTN', 'Airtel', 'Glo', '9mobile'];

function toBundlePlan(bundle: ReturnType<typeof getMonthlyBundles>[number]): BundlePlan {
  return {
    id: bundle.id,
    name: bundle.name,
    gb: bundle.dataGB,
    price: bundle.priceNGN,
    validity: bundle.validityDays,
    ussdCode: bundle.ussdCode,
    pricePerGb: bundle.costPerGB,
    network: bundle.carrier,
    cheapDataHubId: bundle.cheapDataHubId,
  };
}

function getRecommendedPlans(plans: BundlePlan[], projectedGB: number) {
  const bufferedGB = projectedGB * 1.2;
  const covering = plans.filter((plan) => plan.gb >= bufferedGB);
  const below = plans.filter((plan) => plan.gb < bufferedGB);
  const recommended: BundlePlan[] = [];

  recommended.push(...covering.slice(0, 2));

  if (below.length > 0) {
    recommended.push(below[below.length - 1]);
  }

  for (const plan of plans) {
    if (recommended.length >= 3) break;
    if (!recommended.some((item) => item.id === plan.id)) {
      recommended.push(plan);
    }
  }

  return recommended.slice(0, 3);
}

function formatPlanSize(plan: BundlePlan) {
  if (plan.gb >= 1) {
    return `${plan.gb.toLocaleString()} GB`;
  }

  const namedSize = plan.name.match(/(\d+(?:\.\d+)?)\s*MB/i);
  if (namedSize) {
    return `${namedSize[1]} MB`;
  }

  return `${Math.round(plan.gb * 1024).toLocaleString()} MB`;
}

function getValueLabel(plan: BundlePlan) {
  if (plan.gb < 1) {
    return plan.validity <= 2 ? 'daily plan' : 'small plan';
  }

  return `₦${plan.pricePerGb.toLocaleString()}/GB`;
}

export default function PlanPickerScreen() {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ── Carrier detection ──
  const detectedCarrierName = useMemo(() => {
    if (!platformCapabilities.automaticUsageTracking) {
      return 'Mobile';
    }

    try {
      const name = UsageAccess.getCarrierName();
      return name || 'Mobile';
    } catch {
      return 'Mobile';
    }
  }, []);

  const detectedCarrierId = useMemo(
    () => normalizeCarrierName(detectedCarrierName),
    [detectedCarrierName],
  );
  const [selectedCarrierId, setSelectedCarrierId] = useState<CarrierId | null>(null);
  const carrierId = selectedCarrierId ?? detectedCarrierId ?? 'MTN';
  const carrierName = carrierId;

  // ── Usage projection ──
  const hasAutomaticUsage = platformCapabilities.automaticUsageTracking && Platform.OS === 'android';
  const { grandTotal, isLoading: usageLoading } = useDataUsage('week', hasAutomaticUsage);
  const [usageLoadStarted, setUsageLoadStarted] = useState(false);
  const [usageSettled, setUsageSettled] = useState(false);

  useEffect(() => {
    if (!hasAutomaticUsage) {
      setUsageSettled(true);
      return;
    }

    if (usageLoading) {
      setUsageLoadStarted(true);
      return;
    }

    if (usageLoadStarted) {
      setUsageSettled(true);
    }
  }, [hasAutomaticUsage, usageLoadStarted, usageLoading]);
  const projectedMonthlyBytes = useMemo(
    () => projectMonthlyUsage(grandTotal, 'week'),
    [grandTotal],
  );
  const projectedGB = useMemo(() => {
    if (!hasAutomaticUsage) return 3;
    return Math.max(1, Math.round((projectedMonthlyBytes / GB) * 10) / 10);
  }, [hasAutomaticUsage, projectedMonthlyBytes]);

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
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [allPlans, setAllPlans] = useState<BundlePlan[]>([]);
  const [allPlansLoading, setAllPlansLoading] = useState(false);
  const [allPlansError, setAllPlansError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!carrierId) {
      setLivePlans([]);
      setPlansLoading(false);
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
        setLivePlans(data.plans ?? []);
      }

      setPlansLoading(false);
    }

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, [carrierId]);

  const recommendedSource = livePlans.length > 0 ? livePlans : fallbackPlans;
  const recommendedPlans = useMemo(
    () => getRecommendedPlans(recommendedSource, projectedGB),
    [projectedGB, recommendedSource],
  );
  const localAllPlans = useMemo(() => {
    if (!carrierId) return [];
    return getBundlesForCarrier(carrierId).map(toBundlePlan);
  }, [carrierId]);
  const plans = showAllPlans ? allPlans : recommendedPlans;
  const recommendationsLoading = plansLoading || !usageSettled;

  const loadAllPlans = useCallback(async () => {
    if (!carrierId) return;

    setShowAllPlans(true);
    if (allPlans.length > 0) return;

    setAllPlansLoading(true);
    setAllPlansError(null);

    const { data, error } = await supabase.functions.invoke('get-data-plans', {
      body: { network: carrierId },
    });

    if (error || data?.status !== 'success') {
      setAllPlans(localAllPlans);
      setAllPlansError(
        data?.error ?? error?.message ?? 'Could not load every live plan',
      );
    } else {
      setAllPlans(data.plans ?? []);
    }

    setAllPlansLoading(false);
  }, [allPlans.length, carrierId, localAllPlans]);

  useEffect(() => {
    setAllPlans([]);
    setAllPlansError(null);
    setShowAllPlans(false);
  }, [carrierId]);

  const renderNetworkSelector = () => (
    <View
      style={[
        styles.networkSelector,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}>
      <Text style={[styles.networkSelectorLabel, { color: theme.textMuted }]}>
        NETWORK
      </Text>
      <View style={styles.networkChips}>
        {NETWORK_CHOICES.map((network) => {
          const selected = carrierId === network;
          return (
            <Pressable
              key={network}
              onPress={() => setSelectedCarrierId(network)}
              style={[
                styles.networkChip,
                {
                  backgroundColor: selected
                    ? '#6366F1'
                    : isDark
                      ? '#0d1626'
                      : theme.surfaceAlt,
                  borderColor: selected ? '#6366F1' : theme.border,
                },
              ]}>
              <Text
                style={[
                  styles.networkChipText,
                  { color: selected ? '#FFFFFF' : theme.text },
                ]}>
                {network}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

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
  useEffect(() => {
    if (bestValueId && !plans.some((plan) => plan.id === selectedId)) {
      setSelectedId(bestValueId);
    }
  }, [bestValueId, plans, selectedId]);

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
      const valueCopy =
        selectedPlan.gb >= 1
          ? ` at ₦${selectedPlan.pricePerGb.toLocaleString()}/GB`
          : '';
      return `Your projected usage is ${projectedGB} GB/month. The ${selectedPlan.name} gives you a ${buffer.toFixed(1)} GB buffer${valueCopy} — the best fit for your usage pattern.`;
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

  const renderPlan = useCallback(({ item: plan }: { item: BundlePlan }) => {
    const isSelected = selectedId === plan.id;
    const isBestValue = !showAllPlans && plan.id === bestValueId;
    const status = getStatus(plan);

    return (
      <Pressable
        onPress={() => setSelectedId(plan.id)}
        style={showAllPlans && styles.allPlanItem}
      >
        <Card
          style={[
            styles.planCard,
            isSelected && {
              borderColor: '#6366F1',
              borderWidth: 1.5,
            },
          ]}>
          {isBestValue && (
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>Best value</Text>
            </View>
          )}

          <View style={styles.planRow}>
            <View style={styles.planInfo}>
              <Text style={[styles.planName, { color: theme.text }]}>
                {showAllPlans ? plan.name : `${formatPlanSize(plan)} monthly`}
              </Text>
              <View style={styles.planTags}>
                <View style={[styles.tagPill, { backgroundColor: isDark ? '#0d1626' : theme.surfaceAlt }]}>
                  <Text style={[styles.tagText, { color: theme.textMuted }]}>{plan.validity} days</Text>
                </View>
                <View style={[styles.tagPill, { backgroundColor: isDark ? '#0d1626' : theme.surfaceAlt }]}>
                  <Text style={[styles.tagText, { color: theme.textMuted }]}>
                    {getValueLabel(plan)}
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
                        color: status === 'covers' ? '#10B981' : '#EC4899',
                      },
                    ]}>
                    {status === 'covers' ? 'covers your usage' : 'may run short'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.planRight}>
              <Text style={styles.planPrice}>₦{plan.price.toLocaleString()}</Text>
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  }, [bestValueId, getStatus, isDark, selectedId, showAllPlans, theme]);

  if (showAllPlans) {
    return (
      <FlatList
        data={allPlansLoading ? [] : allPlans}
        renderItem={renderPlan}
        keyExtractor={(plan) => plan.id}
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.allPlansContent}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        initialNumToRender={ALL_PLANS_BATCH_SIZE}
        maxToRenderPerBatch={ALL_PLANS_BATCH_SIZE}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        ListHeaderComponent={
          <>
            <HeroHeader style={{ paddingTop: insets.top + Spacing.four }}>
              <View style={styles.heroTitleRow}>
                <View>
                  <Text style={styles.heroTag}>Projected this month</Text>
                  <SensitiveValue>
                    <Text style={styles.heroValue}>{projectedGB} GB</Text>
                  </SensitiveValue>
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

            <View style={[styles.contentArea, styles.allPlansHeader, { marginTop: -Spacing.four }]}>
              {renderNetworkSelector()}

              <View
                style={[
                  styles.sectionTitleRow,
                  styles.planSectionHeader,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}>
                <Text style={[styles.sectionLabel, { color: theme.text }]}>
                  ALL {carrierId ?? 'NETWORK'} PLANS
                </Text>
                <Pressable
                  onPress={() => setShowAllPlans(false)}
                  style={({ pressed }) => [
                    styles.inlineButton,
                    {
                      backgroundColor: theme.surfaceAlt,
                      borderColor: isDark ? '#6366F1' : '#C7D2FE',
                    },
                    pressed && { opacity: 0.78 },
                  ]}>
                  <Text style={[styles.inlineButtonText, { color: theme.text }]}>
                    Recommended
                  </Text>
                </Pressable>
              </View>

              {allPlansError && (
                <Text style={[styles.fallbackText, { color: theme.textMuted }]}>
                  Live catalog unavailable. Showing saved plans for this network.
                </Text>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={[styles.contentArea, styles.emptyPlans]}>
            {allPlansLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#6366F1" />
                <Text style={[styles.loadingText, { color: theme.textMuted }]}>
                  Loading all available plans...
                </Text>
              </View>
            ) : (
              <Text style={[styles.fallbackText, { color: theme.textMuted }]}>
                No plans are available for this network right now.
              </Text>
            )}
          </View>
        }
        ListFooterComponent={
          <View style={styles.allPlansFooter}>
            {selectedPlan && (
              <InsightCard
                title={`Why ${formatPlanSize(selectedPlan)}?`}
                message={insightMessage}
                accentColor="#6366F1"
              />
            )}

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
                  ? `Buy ${formatPlanSize(selectedPlan)} for ₦${selectedPlan.price.toLocaleString()}`
                  : 'Select a plan to continue'}
              </Text>
            </Pressable>
          </View>
        }
      />
    );
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}>
      {/* ──── Hero Section ──── */}
      <HeroHeader style={{ paddingTop: insets.top + Spacing.four }}>
        <View style={styles.heroTitleRow}>
          <View>
            <Text style={styles.heroTag}>Projected this month</Text>
            <SensitiveValue>
              <Text style={styles.heroValue}>{projectedGB} GB</Text>
            </SensitiveValue>
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
        {renderNetworkSelector()}

        <View
          style={[
            styles.sectionTitleRow,
            styles.planSectionHeader,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>
            RECOMMENDED PLANS
          </Text>
          <Pressable
            onPress={loadAllPlans}
            disabled={!carrierId || allPlansLoading}
            style={({ pressed }) => [
              styles.inlineButton,
              {
                backgroundColor: theme.surfaceAlt,
                borderColor: isDark ? '#6366F1' : '#C7D2FE',
              },
              pressed && { opacity: 0.78 },
              (!carrierId || allPlansLoading) && { opacity: 0.5 },
            ]}>
            <Text style={[styles.inlineButtonText, { color: theme.text }]}>
              {allPlansLoading ? 'Loading...' : 'View all plans'}
            </Text>
          </Pressable>
        </View>

        {recommendationsLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#6366F1" />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              Preparing recommendations...
            </Text>
          </View>
        )}

        {!recommendationsLoading && plansError && (
          <Text style={[styles.fallbackText, { color: theme.textMuted }]}>
            Live prices unavailable. Showing saved plans.
          </Text>
        )}

        {/* Plan cards */}
        {!recommendationsLoading && plans.map((plan) => {
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
                      {formatPlanSize(plan)} monthly
                    </Text>
                    <View style={styles.planTags}>
                      <View style={[styles.tagPill, { backgroundColor: isDark ? '#0d1626' : theme.surfaceAlt }]}>
                        <Text style={[styles.tagText, { color: theme.textMuted }]}>{plan.validity} days</Text>
                      </View>
                      <View style={[styles.tagPill, { backgroundColor: isDark ? '#0d1626' : theme.surfaceAlt }]}>
                        <Text style={[styles.tagText, { color: theme.textMuted }]}>
                          {getValueLabel(plan)}
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
            title={`Why ${formatPlanSize(selectedPlan)}?`}
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
              ? `Buy ${formatPlanSize(selectedPlan)} for ₦${selectedPlan.price.toLocaleString()}`
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
  allPlansContent: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  allPlansHeader: {
    paddingBottom: Spacing.three,
  },
  allPlanItem: {
    paddingHorizontal: Spacing.three,
  },
  allPlansFooter: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  emptyPlans: {
    paddingBottom: Spacing.four,
  },
  networkSelector: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 12,
    gap: Spacing.two,
  },
  networkSelectorLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.8,
  },
  networkChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  networkChip: {
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  networkChipText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  planSectionHeader: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Spacing.two,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: -Spacing.one,
  },
  inlineButton: {
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  inlineButtonText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
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
