import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ThemeToggle } from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/use-theme';
import type { BundlePlan } from '@/types/payments';

// ── Numpad layout ──────────────────────────────────────────────────────────

const NUMPAD_KEYS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '',  '0', 'del',
] as const;

export default function ConfirmPurchaseScreen() {
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
    fundAmount: string;
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

  const fundAmount = Number(params.fundAmount) || 0;
  const carrierName = params.carrierName ?? 'Mobile';
  const projectedGB = params.projectedGB ?? '0';

  // ── Mock wallet balance (Phase 1) ──
  // TODO(backend): replace with real wallet balance in Phase 2
  const currentBalance = 1200;
  const newBalance = currentBalance + fundAmount;
  const remainingBalance = newBalance - plan.price;

  // ── PIN state ──
  const [pin, setPin] = useState<string[]>([]);
  const [pinHint, setPinHint] = useState('Enter your 4-digit PIN');
  const [isVerifying, setIsVerifying] = useState(false);
  const [pinError, setPinError] = useState(false);

  const handlePinKey = useCallback(
    (key: string) => {
      if (isVerifying) return;

      if (key === 'del') {
        setPin((prev) => prev.slice(0, -1));
        setPinError(false);
        setPinHint('Enter your 4-digit PIN');
        return;
      }

      if (key === '' || pin.length >= 4) return;

      const newPin = [...pin, key];
      setPin(newPin);

      if (newPin.length === 4) {
        // 4th digit entered — start verification
        setIsVerifying(true);
        setPinHint('Verifying...');

        // TODO(backend): replace with real purchase call in Phase 2
        // Will call: usePurchase.purchase() which calls Supabase Edge Function
        setTimeout(() => {
          // Phase 1: always succeed
          const txId = `DW-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`;

          router.replace({
            pathname: '/purchase-success' as any,
            params: {
              planName: plan.name,
              planGb: String(plan.gb),
              planPrice: String(plan.price),
              planValidity: String(plan.validity),
              transactionId: txId,
              remainingBalance: String(remainingBalance),
              carrierName,
              projectedGB,
            },
          });
        }, 700);
      }
    },
    [pin, isVerifying, plan, remainingBalance, router, carrierName, projectedGB],
  );

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

      <Text style={[styles.pageTitle, { color: theme.text }]}>
        Confirm purchase
      </Text>

      <View style={styles.content}>
        {/* ──── Plan summary hero ──── */}
        <Card style={styles.summaryCard}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>You’re buying</Text>
          <Text style={styles.summaryAmount}>{plan.gb} GB</Text>
          <Text style={[styles.summaryNetwork, { color: theme.textMuted }]}>
            {carrierName} monthly plan
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? '#0a1f18' : '#ecfdf5' }]}>
              <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>
                Covers your usage
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? '#1a1040' : '#eef2ff' }]}>
              <Text style={[styles.statusBadgeText, { color: '#818cf8' }]}>
                Best value
              </Text>
            </View>
          </View>
        </Card>

        {/* ──── Order details ──── */}
        <Card style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Plan cost</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              ₦{plan.price.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Wallet balance</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              ₦{newBalance.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Deducted from wallet</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              ₦{plan.price.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Remaining balance</Text>
            <Text style={[styles.detailValue, { color: '#10B981' }]}>
              ₦{remainingBalance.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Delivery</Text>
            <Text style={[styles.detailValue, { color: '#10B981' }]}>
              Instant
            </Text>
          </View>
        </Card>

        {/* ──── PIN Entry ──── */}
        <Card style={styles.pinCard}>
          <Text style={[styles.pinLabel, { color: theme.textMuted }]}>Confirm with PIN</Text>

          {/* PIN dots */}
          <View style={styles.pinDots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  pin.length > i && styles.pinDotFilled,
                  pinError && pin.length > i && styles.pinDotError,
                ]}
              />
            ))}
          </View>

          <Text
            style={[
              styles.pinHintText,
              { color: theme.textMuted },
              isVerifying && { color: '#6366F1' },
              pinError && { color: '#EC4899' },
            ]}>
            {pinHint}
          </Text>

          {/* Numpad */}
          <View style={styles.numpad}>
            {NUMPAD_KEYS.map((key, index) => {
              if (key === '') {
                return <View key={`empty-${index}`} style={styles.numpadEmpty} />;
              }
              if (key === 'del') {
                return (
                  <Pressable
                    key="del"
                    onPress={() => handlePinKey('del')}
                    style={({ pressed }) => [
                      styles.numpadBtn,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <Ionicons name="backspace-outline" size={20} color={theme.textMuted} />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={key}
                  onPress={() => handlePinKey(key)}
                  style={({ pressed }) => [
                    styles.numpadBtn,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.numpadDigit, { color: theme.text }]}>{key}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
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
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  summaryCard: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(107,122,153,1)',
    marginBottom: Spacing.two,
  },
  summaryAmount: {
    fontSize: 40,
    fontFamily: Fonts.numberBold,
    color: '#6366F1',
    letterSpacing: -2,
  },
  summaryNetwork: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: 'rgba(139,163,204,1)',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  detailsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: Fonts.regular,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: Fonts.numberSemiBold,
  },
  detailDivider: {
    height: 1,
  },
  pinCard: {
    paddingVertical: Spacing.three,
  },
  pinLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: 'rgba(139,163,204,1)',
    marginBottom: Spacing.two,
  },
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginVertical: Spacing.three,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2a3a5c',
  },
  pinDotFilled: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  pinDotError: {
    backgroundColor: '#EC4899',
    borderColor: '#EC4899',
  },
  pinHintText: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: 'rgba(107,122,153,1)',
    marginBottom: Spacing.three,
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.one,
  },
  numpadBtn: {
    width: '31%',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadEmpty: {
    width: '31%',
  },
  numpadDigit: {
    fontSize: 20,
    fontFamily: Fonts.numberBold,
  },
});
