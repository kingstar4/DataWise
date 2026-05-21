import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, SensitiveValue, ThemeToggle } from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useWalletContext } from '@/context/WalletContext';
import { useTheme } from '@/hooks/use-theme';
import { usePurchase } from '@/hooks/usePurchase';
import type { BundlePlan } from '@/types/payments';

// ── Numpad layout ──────────────────────────────────────────────────────────

const NUMPAD_KEYS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '', '0', 'del',
] as const;

const formatPhoneNumber = (raw: string) => raw.replace(/\D/g, '');

const isValidNigerianPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  return (digits.startsWith('0') && digits.length === 11) ||
    (digits.startsWith('234') && digits.length === 13);
};

const formatPlanSize = (gb: number, name: string) => {
  if (gb >= 1) return `${gb.toLocaleString()} GB`;

  const namedSize = name.match(/(\d+(?:\.\d+)?)\s*MB/i);
  if (namedSize) return `${namedSize[1]} MB`;

  return `${Math.round(gb * 1024).toLocaleString()} MB`;
};

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
    planNetwork: string;
    planCheapDataHubId: string;
    fundAmount: string;
    carrierName: string;
    projectedGB: string;
    paystackRef: string;
    transactionId: string;
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
      network: params.planNetwork ?? params.carrierName ?? '',
      cheapDataHubId: params.planCheapDataHubId ? Number(params.planCheapDataHubId) : undefined,
    }),
    [params],
  );

  const fundAmount = Number(params.fundAmount) || 0;
  const carrierName = params.carrierName ?? 'Mobile';
  const projectedGB = params.projectedGB ?? '0';
  const planSize = formatPlanSize(plan.gb, plan.name);

  // ── Real wallet balance ──
  const { balance: walletBalance, deduct, addTransaction, refetch } = useWalletContext();

  // ── Purchase hook ──
  const { purchase, status: purchaseStatus, error: purchaseError, transactionId } =
    usePurchase(plan, walletBalance, deduct, addTransaction, refetch);

  const newBalance = walletBalance + fundAmount;
  const remainingBalance = newBalance - plan.price;

  // ── Paystack payment status polling ──
  // When user returns from Paystack browser, refetch wallet to check if it was credited
  const [waitingForPayment, setWaitingForPayment] = useState(fundAmount > 0);
  const [paymentConfirmed, setPaymentConfirmed] = useState(fundAmount === 0);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (!waitingForPayment) return;

    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        // User returned from browser — refetch wallet
        await refetch();
      }
    });

    return () => subscription.remove();
  }, [waitingForPayment, refetch]);

  // Check if wallet now has enough after refetch
  useEffect(() => {
    if (!waitingForPayment) return;
    if (walletBalance >= plan.price) {
      setWaitingForPayment(false);
      setPaymentConfirmed(true);
    }
  }, [walletBalance, plan.price, waitingForPayment]);

  // ── PIN state ──
  const [pin, setPin] = useState<string[]>([]);
  const [pinHint, setPinHint] = useState('Enter your 4-digit PIN to confirm');
  const [pinError, setPinError] = useState(false);

  const isVerifying = purchaseStatus === 'processing';

  const handlePinKey = useCallback(async (key: string) => {
    if (isVerifying) return;

    if (key === 'del') {
      setPin((prev) => prev.slice(0, -1));
      setPinError(false);
      setPinHint('Enter your 4-digit PIN to confirm');
      return;
    }

    if (key === '' || pin.length >= 4) return;

    const newPin = [...pin, key];
    setPin(newPin);

    if (newPin.length === 4) {
      setPinHint('Verifying...');

      if (!isValidNigerianPhone(phoneNumber)) {
        setPinHint('Enter a valid Nigerian phone number');
        setPinError(true);
        setPin([]);
        return;
      }

      // If payment not yet confirmed, show waiting message
      if (!paymentConfirmed) {
        setPinHint('Waiting for payment confirmation...');
        setPinError(true);
        setPin([]);
        return;
      }

      // Call real purchase edge function
      const success = await purchase(newPin.join(''), formatPhoneNumber(phoneNumber));

      if (success) {
        router.replace({
          pathname: '/purchase-success' as any,
          params: {
            planName: plan.name,
            planGb: String(plan.gb),
            planPrice: String(plan.price),
            planValidity: String(plan.validity),
            transactionId: transactionId ?? '',
            remainingBalance: String(remainingBalance),
            carrierName,
            projectedGB,
          },
        });
      } else {
        // Show error on PIN dots
        setPinError(true);
        setPinHint(purchaseError ?? 'Purchase failed. Please try again.');
        // Reset PIN after short delay
        setTimeout(() => {
          setPin([]);
          setPinError(false);
          setPinHint('Enter your 4-digit PIN to confirm');
        }, 2000);
      }
    }
  }, [
    pin, isVerifying, paymentConfirmed, purchase, phoneNumber,
    transactionId, remainingBalance, plan,
    router, carrierName, projectedGB, purchaseError,
  ]);

  // ── Payment waiting banner ──
  const renderPaymentStatus = () => {
    if (fundAmount === 0) return null;

    if (paymentConfirmed) {
      return (
        <View style={[styles.statusBanner, { backgroundColor: isDark ? '#0a1f18' : '#ecfdf5' }]}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.statusBannerText, { color: '#10B981' }]}>
            Payment confirmed — wallet funded
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.statusBanner, { backgroundColor: isDark ? '#1a1508' : '#fffbeb' }]}>
        <ActivityIndicator size="small" color="#F59E0B" />
        <Text style={[styles.statusBannerText, { color: '#F59E0B' }]}>
          Waiting for payment... Return here after completing payment
        </Text>
      </View>
    );
  };

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

        {/* ──── Payment status banner ──── */}
        {renderPaymentStatus()}

        {/* ──── Plan summary hero ──── */}
        <Card style={styles.summaryCard}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>{"You're buying"}</Text>
          <Text style={styles.summaryAmount}>{planSize}</Text>
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
            <SensitiveValue>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                ₦{walletBalance.toLocaleString()}
              </Text>
            </SensitiveValue>
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
            <SensitiveValue>
              <Text style={[styles.detailValue, { color: '#10B981' }]}>
                ₦{remainingBalance.toLocaleString()}
              </Text>
            </SensitiveValue>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Delivery</Text>
            <Text style={[styles.detailValue, { color: '#10B981' }]}>Instant</Text>
          </View>
        </Card>

        <Card style={styles.phoneCard}>
          <Text style={[styles.pinLabel, { color: theme.textMuted }]}>Delivery phone number</Text>
          <TextInput
            value={phoneNumber}
            onChangeText={(value) => {
              setPhoneNumber(value.replace(/[^\d+]/g, '').slice(0, 14));
              setPinError(false);
              setPinHint('Enter your 4-digit PIN to confirm');
            }}
            placeholder="08012345678"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
            style={[
              styles.phoneInput,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />
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
                  pinError && styles.pinDotError,
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
            {isVerifying ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : pinHint}
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
                    disabled={isVerifying}
                    style={({ pressed }) => [
                      styles.numpadBtn,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      pressed && { opacity: 0.7 },
                      isVerifying && { opacity: 0.4 },
                    ]}>
                    <Ionicons name="backspace-outline" size={20} color={theme.textMuted} />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={key}
                  onPress={() => handlePinKey(key)}
                  disabled={isVerifying}
                  style={({ pressed }) => [
                    styles.numpadBtn,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    pressed && { opacity: 0.7 },
                    isVerifying && { opacity: 0.4 },
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
  scrollView: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 14, fontFamily: Fonts.medium },
  pageTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: BorderRadius.md,
  },
  statusBannerText: { fontSize: 13, fontFamily: Fonts.medium, flex: 1 },
  summaryCard: { alignItems: 'center', paddingVertical: Spacing.four },
  summaryLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: Spacing.two },
  summaryAmount: {
    fontSize: 40,
    fontFamily: Fonts.numberBold,
    color: '#6366F1',
    letterSpacing: -2,
  },
  summaryNetwork: { fontSize: 13, fontFamily: Fonts.medium, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontFamily: Fonts.bold },
  detailsCard: { padding: 0, overflow: 'hidden' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  detailLabel: { fontSize: 13, fontFamily: Fonts.regular },
  detailValue: { fontSize: 13, fontFamily: Fonts.numberSemiBold },
  detailDivider: { height: 1 },
  phoneCard: { paddingVertical: Spacing.three },
  phoneInput: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    padding: 14,
    fontSize: 15,
    fontFamily: Fonts.numberRegular,
  },
  pinCard: { paddingVertical: Spacing.three },
  pinLabel: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: Spacing.two },
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
  pinDotFilled: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  pinDotError: { backgroundColor: '#EC4899', borderColor: '#EC4899' },
  pinHintText: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginBottom: Spacing.three,
  },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: Spacing.one },
  numpadBtn: {
    width: '31%',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadEmpty: { width: '31%' },
  numpadDigit: { fontSize: 20, fontFamily: Fonts.numberBold },
});
