import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ThemeToggle } from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/use-theme';
import type { BundlePlan } from '@/types/payments';

// ── Quick amounts ──────────────────────────────────────────────────────────

const QUICK_AMOUNTS = [1000, 2000, 3000, 5000] as const;

export default function WalletFundScreen() {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ── Route params ──
  const params = useLocalSearchParams<{
    planId: string;
    planName: string;
    planGb: string;
    planPrice: string;
    planValidity: string;
    planUssd: string;
    planPricePerGb: string;
    carrierName: string;
    projectedGB: string;
  }>();

  const plan: BundlePlan = useMemo(
    () => ({
      id: params.planId ?? '',
      name: params.planName ?? '',
      gb: Number(params.planGb) || 0,
      price: Number(params.planPrice) || 0,
      validity: Number(params.planValidity) || 30,
      ussdCode: params.planUssd ?? '',
      pricePerGb: Number(params.planPricePerGb) || 0,
    }),
    [params],
  );

  // ── Mock wallet balance (Phase 1 local state) ──
  // TODO(backend): replace with real wallet balance from useWallet hook in Phase 2
  const walletBalance = 1200;

  // ── Amount selection ──
  // Smart default: pick the chip that brings balance just above plan price
  const smartDefault = useMemo(() => {
    const gap = plan.price - walletBalance;
    if (gap <= 0) return QUICK_AMOUNTS[0]; // already enough
    return QUICK_AMOUNTS.find((a) => a >= gap) ?? QUICK_AMOUNTS[QUICK_AMOUNTS.length - 1];
  }, [plan.price, walletBalance]);

  const [selectedAmount, setSelectedAmount] = useState<number>(smartDefault);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const effectiveAmount = isCustom ? (parseInt(customAmount, 10) || 0) : selectedAmount;
  const newBalance = walletBalance + effectiveAmount;
  const canAfford = newBalance >= plan.price;
  const gap = plan.price - newBalance;

  // ── Pay method ──
  const [payMethod, setPayMethod] = useState<1 | 2>(1);

  // ── Subtitle text ──
  const subtitleText = useMemo(() => {
    if (effectiveAmount <= 0) return `Need ₦${(plan.price - walletBalance).toLocaleString()} more for ${plan.name}`;
    if (canAfford) return `New balance: ₦${newBalance.toLocaleString()} — ready to buy`;
    return `New balance: ₦${newBalance.toLocaleString()} — need ₦${Math.abs(gap).toLocaleString()} more`;
  }, [effectiveAmount, canAfford, newBalance, gap, plan, walletBalance]);

  // ── Quick amount press ──
  const handleQuickAmount = useCallback((amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount('');
  }, []);

  // ── Custom amount input ──
  const handleCustomInput = useCallback((value: string) => {
    setCustomAmount(value);
    setIsCustom(true);
  }, []);

  // ── Continue ──
  const handleContinue = useCallback(() => {
    router.push({
      pathname: '/confirm-purchase' as any,
      params: {
        planId: plan.id,
        planName: plan.name,
        planGb: String(plan.gb),
        planPrice: String(plan.price),
        planValidity: String(plan.validity),
        planUssd: plan.ussdCode,
        planPricePerGb: String(plan.pricePerGb),
        fundAmount: String(effectiveAmount),
        carrierName: params.carrierName ?? '',
        projectedGB: params.projectedGB ?? '',
      },
    });
  }, [plan, effectiveAmount, router, params]);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{
        paddingBottom: BottomTabInset + Spacing.four,
        paddingTop: insets.top,
      }}>
      {/* ──── Back nav + toggle ──── */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
          <Text style={[styles.backText, { color: theme.textMuted }]}>Back</Text>
        </Pressable>
        <ThemeToggle variant="surface" />
      </View>

      <Text style={[styles.pageTitle, { color: theme.text }]}>Fund wallet</Text>

      {/* ──── Wallet balance card ──── */}
      <View style={styles.section}>
        <Card style={styles.walletCard}>
          <Text style={[styles.walletLabel, { color: theme.textMuted }]}>CURRENT BALANCE</Text>
          <Text style={styles.walletBalance}>
            ₦{walletBalance.toLocaleString()}
          </Text>
          <Text style={[styles.walletSub, { color: theme.textMuted }]}>{subtitleText}</Text>
        </Card>
      </View>

      {/* ──── Top up amount ──── */}
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
        TOP UP AMOUNT
      </Text>

      <View style={styles.amountGrid}>
        {QUICK_AMOUNTS.map((amount) => {
          const isActive = !isCustom && selectedAmount === amount;
          const amountNewBal = walletBalance + amount;
          let chipSub = 'quick add';
          if (plan.price > 0 && amountNewBal >= plan.price) {
            chipSub = `covers ${plan.gb} GB`;
          }

          return (
            <Pressable
              key={amount}
              onPress={() => handleQuickAmount(amount)}
              style={[
                styles.amountChip,
                { backgroundColor: theme.card, borderColor: theme.border },
                isActive && { borderColor: '#6366F1', backgroundColor: isDark ? 'rgba(22,30,56,1)' : '#eef2ff' },
              ]}>
              <Text style={[styles.amountValue, { color: theme.text }]}>
                ₦{amount.toLocaleString()}
              </Text>
              <Text style={[styles.amountSub, { color: theme.textMuted }]}>{chipSub}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Custom input */}
      <View style={styles.customInputWrap}>
        <TextInput
          value={customAmount}
          onChangeText={handleCustomInput}
          placeholder="Or enter custom amount (₦)"
          placeholderTextColor={theme.textMuted}
          keyboardType="numeric"
          style={[
            styles.customInput,
            { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
            isCustom && customAmount.length > 0 && { borderColor: '#6366F1' },
          ]}
        />
      </View>

      {/* ──── Pay via ──── */}
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
        PAY VIA
      </Text>

      <View style={[styles.payMethodCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {/* Paystack */}
        <Pressable
          onPress={() => setPayMethod(1)}
          style={[styles.payRow, { borderBottomColor: theme.border }, payMethod === 1 && { backgroundColor: isDark ? '#0d1626' : theme.surfaceAlt }]}>
          <View style={[styles.payIcon, { backgroundColor: isDark ? '#1a1040' : '#eef2ff' }]}>
            <Ionicons name="card" size={16} color="#6366F1" />
          </View>
          <View style={styles.payLabel}>
            <Text style={[styles.payLabelTitle, { color: theme.text }]}>Paystack</Text>
            <Text style={[styles.payLabelSub, { color: theme.textMuted }]}>Card or bank transfer</Text>
          </View>
          <View style={[styles.radio, payMethod === 1 && styles.radioSelected]}>
            {payMethod === 1 && <View style={styles.radioDot} />}
          </View>
        </Pressable>

        {/* Bank transfer */}
        <Pressable
          onPress={() => setPayMethod(2)}
          style={[styles.payRow, { borderBottomColor: theme.border }, payMethod === 2 && { backgroundColor: isDark ? '#0d1626' : theme.surfaceAlt }]}>
          <View style={[styles.payIcon, { backgroundColor: isDark ? '#0a1f18' : '#ecfdf5' }]}>
            <Ionicons name="business" size={16} color="#10B981" />
          </View>
          <View style={styles.payLabel}>
            <Text style={[styles.payLabelTitle, { color: theme.text }]}>Bank transfer</Text>
            <Text style={[styles.payLabelSub, { color: theme.textMuted }]}>Direct to DataWise account</Text>
          </View>
          <View style={[styles.radio, payMethod === 2 && styles.radioSelected]}>
            {payMethod === 2 && <View style={styles.radioDot} />}
          </View>
        </Pressable>
      </View>

      {/* ──── CTA ──── */}
      <View style={styles.ctaSection}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && { opacity: 0.85 },
          ]}>
          <Text style={styles.ctaText}>
            Fund ₦{effectiveAmount.toLocaleString()} and buy plan
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.ghostButton,
            { borderColor: theme.border },
            pressed && { opacity: 0.8 },
          ]}>
          <Text style={[styles.ghostText, { color: theme.textMuted }]}>Cancel</Text>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },

  pageTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  section: {
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  walletCard: {
    paddingVertical: Spacing.four,
  },
  walletLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: 'rgba(107,122,153,1)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  walletBalance: {
    fontSize: 32,
    fontFamily: Fonts.numberBold,
    color: '#10B981',
    letterSpacing: -1,
  },
  walletSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  amountChip: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  amountValue: {
    fontSize: 16,
    fontFamily: Fonts.numberBold,
  },
  amountSub: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    marginTop: 3,
  },
  customInputWrap: {
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.four,
  },
  customInput: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    padding: 14,
    fontSize: 15,
    fontFamily: Fonts.numberRegular,
  },
  payMethodCard: {
    marginHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.four,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
  },
  payIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payLabel: {
    flex: 1,
  },
  payLabelTitle: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  payLabelSub: {
    fontSize: 11,
    fontFamily: Fonts.regular,
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
  ctaSection: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  ctaButton: {
    backgroundColor: '#6366F1',
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
});
