import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/use-theme';

export default function PurchaseSuccessScreen() {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ── Route params ──
  const params = useLocalSearchParams<{
    planName: string;
    planGb: string;
    planPrice: string;
    planValidity: string;
    transactionId: string;
    remainingBalance: string;
    carrierName: string;
    projectedGB: string;
  }>();

  const planName = params.planName ?? '';
  const planGb = Number(params.planGb) || 0;
  const planPrice = Number(params.planPrice) || 0;
  const planValidity = Number(params.planValidity) || 30;
  const transactionId = params.transactionId ?? '';
  const remainingBalance = Number(params.remainingBalance) || 0;
  const carrierName = params.carrierName ?? 'Mobile';
  const projectedGB = Number(params.projectedGB) || 1;

  // ── Computed values ──
  const expiryDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + planValidity);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [planValidity]);

  // Next refill prediction: today + (plan.gb / projectedDailyGB) days
  const nextRefillDate = useMemo(() => {
    const projectedDailyGB = projectedGB / 30;
    const daysUntilRefill = projectedDailyGB > 0
      ? Math.floor(planGb / projectedDailyGB)
      : planValidity;
    const d = new Date();
    d.setDate(d.getDate() + Math.min(daysUntilRefill, planValidity));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [planGb, projectedGB, planValidity]);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{
        paddingBottom: BottomTabInset + Spacing.four,
        paddingTop: insets.top + Spacing.five,
        alignItems: 'center',
        paddingHorizontal: Spacing.four,
      }}>
      {/* ──── Success Ring ──── */}
      <View style={[styles.successRing, { backgroundColor: isDark ? '#0a1f18' : '#ecfdf5' }]}>
        <Ionicons name="checkmark" size={36} color="#10B981" />
      </View>

      {/* ──── Title ──── */}
      <Text style={[styles.successTitle, { color: theme.text }]}>Data activated!</Text>
      <Text style={[styles.successSub, { color: theme.textMuted }]}>
        Your {planGb} GB {carrierName} plan is live.{'\n'}
        DataWise will track your usage automatically.
      </Text>

      {/* ──── Receipt Card ──── */}
      <Card style={styles.receiptCard}>
        <View style={styles.receiptRow}>
          <Text style={[styles.receiptLabel, { color: theme.textMuted }]}>Plan</Text>
          <Text style={[styles.receiptValue, { color: theme.text }]}>
            {planGb} GB {carrierName} monthly
          </Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={[styles.receiptLabel, { color: theme.textMuted }]}>Amount paid</Text>
          <Text style={[styles.receiptValue, { color: theme.text }]}>
            ₦{planPrice.toLocaleString()}
          </Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={[styles.receiptLabel, { color: theme.textMuted }]}>Transaction ID</Text>
          <Text style={[styles.receiptTxId, { color: theme.textMuted }]}>{transactionId}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={[styles.receiptLabel, { color: theme.textMuted }]}>Expires</Text>
          <Text style={[styles.receiptValue, { color: theme.text }]}>{expiryDate}</Text>
        </View>
        <View style={[styles.receiptRow, styles.receiptRowLast, { borderTopColor: theme.border }]}>
          <Text style={[styles.receiptLabel, { color: theme.textMuted }]}>Remaining balance</Text>
          <Text style={[styles.receiptValue, { color: '#818cf8' }]}>
            ₦{remainingBalance.toLocaleString()}
          </Text>
        </View>
      </Card>

      {/* ──── Next refill prediction ──── */}
      <View style={[styles.refillCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="time-outline" size={18} color="#6366F1" />
        <Text style={[styles.refillText, { color: theme.textMuted }]}>
          Based on your usage pattern, you'll likely need your next top-up
          around{' '}
          <Text style={[styles.refillDate, { color: theme.text }]}>{nextRefillDate}</Text>
        </Text>
      </View>

      {/* ──── CTAs ──── */}
      <Pressable
        onPress={() => router.push('/transactions' as any)}
        style={({ pressed }) => [
          styles.ctaButton,
          pressed && { opacity: 0.85 },
        ]}>
        <Text style={styles.ctaText}>View transaction history</Text>
      </Pressable>

      <Pressable
        onPress={() => router.replace('/' as any)}
        style={({ pressed }) => [
          styles.ghostButton,
          { borderColor: theme.border },
          pressed && { opacity: 0.8 },
        ]}>
        <Text style={[styles.ghostText, { color: theme.textMuted }]}>Back to dashboard</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  successRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: Fonts.extraBold,
    marginBottom: Spacing.two,
    letterSpacing: -0.5,
  },
  successSub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.four,
  },
  receiptCard: {
    width: '100%',
    padding: Spacing.three + 4,
    marginBottom: Spacing.three,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  receiptRowLast: {
    marginBottom: 0,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  receiptLabel: {
    fontSize: 12,
    fontFamily: Fonts.regular,
  },
  receiptValue: {
    fontSize: 13,
    fontFamily: Fonts.numberSemiBold,
  },
  receiptTxId: {
    fontSize: 11,
    fontFamily: Fonts.numberRegular,
    letterSpacing: 0.5,
  },
  refillCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 14,
    marginBottom: Spacing.four,
  },
  refillText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.regular,
    lineHeight: 18,
  },
  refillDate: {
    fontFamily: Fonts.bold,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#6366F1',
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  ghostButton: {
    width: '100%',
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
