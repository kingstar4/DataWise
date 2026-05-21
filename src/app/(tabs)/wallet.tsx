import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, HeroHeader, SensitiveValue, ThemeToggle } from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/use-theme';
import { useWalletContext } from '@/context/WalletContext';
import type { Transaction } from '@/types/payments';

// ── Theme-aware status colors ──────────────────────────────────────────────

function getStatusColors(dark: boolean) {
  return {
    success: { bg: dark ? '#0a1f18' : '#ecfdf5', text: '#10B981' },
    pending: { bg: dark ? '#1a1508' : '#fffbeb', text: dark ? '#F59E0B' : '#D97706' },
    failed: { bg: dark ? '#1f0a12' : '#fdf2f8', text: '#EC4899' },
  };
}

function getTxIconColors(dark: boolean) {
  return {
    success: { bg: dark ? '#0a1f18' : '#ecfdf5', stroke: '#10B981' },
    pending: { bg: dark ? '#1a1508' : '#fffbeb', stroke: dark ? '#F59E0B' : '#D97706' },
    failed: { bg: dark ? '#1f0a12' : '#fdf2f8', stroke: '#EC4899' },
  };
}

function getWalletIcon(dark: boolean) {
  return { bg: dark ? '#1a1040' : '#eef2ff', stroke: '#6366F1' };
}

export default function WalletScreen() {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const statusColors = useMemo(() => getStatusColors(isDark), [isDark]);
  const txIconColors = useMemo(() => getTxIconColors(isDark), [isDark]);
  const walletIcon = useMemo(() => getWalletIcon(isDark), [isDark]);

  const { balance, transactions, refetch } = useWalletContext();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // Show only the latest 3 transactions
  const recentTx = useMemo(() => transactions.slice(0, 3), [transactions]);

  // Computed stats
  const totalSpent = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'data' && t.status === 'success')
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  // ── Date formatter ──
  const formatDate = (isoDate: string) => {
    const d = new Date(isoDate);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days === 0) {
      return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    if (days === 1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getAmountColor = (tx: Transaction) => {
    if (tx.type === 'wallet_topup') return '#10B981';
    if (tx.status === 'failed') return '#EC4899';
    return theme.text;
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#6366F1"
          colors={['#6366F1']}
          progressBackgroundColor={theme.card}
        />
      }>
      {/* ──── Hero with balance ──── */}
      <HeroHeader style={{ paddingTop: insets.top + Spacing.four }}>
        <View style={styles.heroTitleRow}>
          <View>
            <Text style={styles.heroLabel}>WALLET BALANCE</Text>
            <SensitiveValue>
              <Text style={styles.heroBalance}>₦{balance.toLocaleString()}</Text>
            </SensitiveValue>
            <Text style={styles.heroSub}>
              Total spent: ₦{totalSpent.toLocaleString()}
            </Text>
          </View>
          <ThemeToggle variant="hero" size={20} />
        </View>
      </HeroHeader>

      {/* ──── Action buttons ──── */}
      <View style={[styles.actionsRow, { marginTop: -Spacing.three }]}>
        <Pressable
          onPress={() => router.push('/plan-picker' as any)}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnPrimary,
            pressed && { opacity: 0.85 },
          ]}>
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="cart" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.actionBtnTextPrimary}>Buy Data</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/wallet-fund' as any)}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnSecondary,
            { backgroundColor: theme.card, borderColor: theme.border },
            pressed && { opacity: 0.85 },
          ]}>
          <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5' }]}>
            <Ionicons name="add-circle" size={18} color="#10B981" />
          </View>
          <Text style={[styles.actionBtnTextSecondary, { color: theme.text }]}>Fund Wallet</Text>
        </Pressable>
      </View>

      {/* ──── Quick stats ──── */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.statIconWrap, { backgroundColor: isDark ? '#0a1f18' : '#ecfdf5' }]}>
            <Ionicons name="trending-up" size={14} color="#10B981" />
          </View>
          <View>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Purchases</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {transactions.filter((t) => t.type === 'data' && t.status === 'success').length}
            </Text>
          </View>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.statIconWrap, { backgroundColor: isDark ? '#1a1040' : '#eef2ff' }]}>
            <Ionicons name="shield-checkmark" size={14} color="#6366F1" />
          </View>
          <View>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Saved</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              ₦2,100
            </Text>
          </View>
        </View>
      </View>

      {/* ──── Recent transactions ──── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Recent Activity
        </Text>
        <Pressable onPress={() => router.push('/transactions' as any)}>
          <Text style={styles.seeAllLink}>See all</Text>
        </Pressable>
      </View>

      <View style={styles.txList}>
        {recentTx.length === 0 && (
          <Card style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={28} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No transactions yet</Text>
            <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>
              Buy data to see your transaction history
            </Text>
          </Card>
        )}

        {recentTx.map((tx) => {
          const isWalletTopup = tx.type === 'wallet_topup';
          const iconColors = isWalletTopup
            ? walletIcon
            : txIconColors[tx.status] ?? txIconColors.success;
          const statusColor = statusColors[tx.status] ?? statusColors.success;

          return (
            <View
              key={tx.id}
              style={[
                styles.txItem,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}>
              <View style={[styles.txIcon, { backgroundColor: iconColors.bg }]}>
                <Ionicons
                  name={
                    isWalletTopup
                      ? 'wallet'
                      : tx.status === 'failed'
                      ? 'close-circle'
                      : 'layers'
                  }
                  size={16}
                  color={iconColors.stroke}
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={[styles.txName, { color: theme.text }]}>{tx.planName}</Text>
                <View style={styles.txSubRow}>
                  <Text style={[styles.txDate, { color: theme.textMuted }]}>{formatDate(tx.date)}  </Text>
                  <View style={[styles.txBadge, { backgroundColor: statusColor.bg }]}>
                    <Text style={[styles.txBadgeText, { color: statusColor.text }]}>
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.txAmount, { color: getAmountColor(tx) }]}>
                {tx.type === 'wallet_topup' ? '+' : ''}₦{tx.amount.toLocaleString()}
              </Text>
            </View>
          );
        })}
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
  },
  heroLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroBalance: {
    fontSize: 36,
    fontFamily: Fonts.numberBold,
    color: '#10B981',
    letterSpacing: -2,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 6,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.lg,
  },
  actionBtnPrimary: {
    backgroundColor: '#6366F1',
  },
  actionBtnSecondary: {
    borderWidth: 1,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTextPrimary: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  actionBtnTextSecondary: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.four,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 14,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontFamily: Fonts.numberBold,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
  },
  seeAllLink: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#6366F1',
  },
  txList: {
    paddingHorizontal: Spacing.three,
    gap: 8,
  },
  txItem: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txName: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    marginBottom: 4,
  },
  txSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txDate: {
    fontSize: 11,
    fontFamily: Fonts.regular,
  },
  txBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
  txAmount: {
    fontSize: 14,
    fontFamily: Fonts.numberBold,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  emptySubtext: {
    fontSize: 12,
    fontFamily: Fonts.regular,
  },
});
