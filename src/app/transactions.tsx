import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SensitiveValue, ThemeToggle } from '@/components/ui';
import { BorderRadius, BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/context/ThemeContext';
import { useWalletContext } from '@/context/WalletContext';
import { useTheme } from '@/hooks/use-theme';
import type { Transaction } from '@/types/payments';

// ── Filter types ───────────────────────────────────────────────────────────

type FilterKey = 'all' | 'data' | 'wallet_topup' | 'failed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'data', label: 'Data' },
  { key: 'wallet_topup', label: 'Wallet top-up' },
  { key: 'failed', label: 'Failed' },
];

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

export default function TransactionsScreen() {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const statusColors = useMemo(() => getStatusColors(isDark), [isDark]);
  const txIconColors = useMemo(() => getTxIconColors(isDark), [isDark]);
  const walletIcon = useMemo(() => getWalletIcon(isDark), [isDark]);

  // ── Wallet data ──
  const { balance, transactions, loading, error, refetch } = useWalletContext();
  const [refreshing, setRefreshing] = useState(false);

  // ── Filter state ──
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  // ── Computed stats ──
  const stats = useMemo(() => {
    const successData = transactions.filter(
      (t) => t.type === 'data' && t.status === 'success',
    );
    const totalSpent = successData.reduce((sum, t) => sum + t.amount, 0);
    const purchaseCount = successData.length;

    const successTopups = transactions.filter(
      (t) => t.type === 'wallet_topup' && t.status === 'success',
    );
    const totalFunded = successTopups.reduce((sum, t) => sum + t.amount, 0);
    const savedAmount = Math.max(0, totalFunded - totalSpent);

    return { totalSpent, purchaseCount, savedAmount };
  }, [transactions]);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'data':
        return transactions.filter((t) => t.type === 'data' && t.status !== 'failed');
      case 'wallet_topup':
        return transactions.filter((t) => t.type === 'wallet_topup');
      case 'failed':
        return transactions.filter((t) => t.status === 'failed');
      default:
        return transactions;
    }
  }, [transactions, activeFilter]);

  // ── Date formatter ──
  const formatDate = useCallback((isoDate: string) => {
    const d = new Date(isoDate);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (days === 0) {
      return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    if (days === 1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  // ── Amount color ──
  const getAmountColor = (tx: Transaction) => {
    if (tx.type === 'wallet_topup') return '#10B981';
    if (tx.status === 'failed') return '#EC4899';
    return theme.text;
  };

  // ── Amount prefix ──
  const getAmountPrefix = (tx: Transaction) => {
    if (tx.type === 'wallet_topup') return '+';
    return '';
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
      contentContainerStyle={{
        paddingBottom: BottomTabInset + Spacing.four,
        paddingTop: insets.top + Spacing.three,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#6366F1"
          colors={['#6366F1']}
          progressBackgroundColor={theme.card}
        />
      }>
      {/* ──── Back nav ──── */}
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
        <Text style={[styles.backText, { color: theme.textMuted }]}>Back</Text>
      </Pressable>

      {/* ──── Header ──── */}
      <View style={styles.headerRow}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>
          Transactions
        </Text>
        <View style={styles.headerActions}>
          <Pressable>
            <Text style={styles.exportLink}>Export</Text>
          </Pressable>
          <ThemeToggle variant="surface" />
        </View>
      </View>

      {/* ──── Summary Grid ──── */}
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCell, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Total spent</Text>
          <Text style={[styles.summaryValue, { color: '#6366F1' }]}>
            ₦{stats.totalSpent.toLocaleString()}
          </Text>
        </View>
        <View style={[styles.summaryCell, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Purchases</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {stats.purchaseCount}
          </Text>
        </View>
        <View style={[styles.summaryCell, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Wallet balance</Text>
          <SensitiveValue>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>
              ₦{balance.toLocaleString()}
            </Text>
          </SensitiveValue>
        </View>
        <View style={[styles.summaryCell, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Saved vs ad-hoc</Text>
          <Text style={[styles.summaryValue, { color: '#10B981' }]}>
            ₦{stats.savedAmount.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* ──── Filter Chips ──── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setActiveFilter(f.key)}
            style={[
              styles.filterChip,
              { backgroundColor: theme.card, borderColor: theme.border },
              activeFilter === f.key && {
                borderColor: '#6366F1',
                backgroundColor: isDark ? 'rgba(22,30,56,1)' : '#eef2ff',
              },
            ]}>
            <Text
              style={[
                styles.filterChipText,
                { color: theme.textMuted },
                activeFilter === f.key && { color: '#6366F1' },
              ]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading && (
        <View style={styles.emptyState}>
          <ActivityIndicator color="#6366F1" />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Loading transactions...
          </Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={32} color="#EC4899" />
          <Text style={[styles.emptyText, { color: '#EC4899' }]}>
            {error}
          </Text>
        </View>
      )}

      {/* ──── Transaction List ──── */}
      <View style={styles.txList}>
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={32} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No transactions found
            </Text>
          </View>
        )}

        {filtered.map((tx) => {
          const isWalletTopup = tx.type === 'wallet_topup';
          const iconColors = isWalletTopup
            ? walletIcon
            : txIconColors[tx.status];
          const statusColor = statusColors[tx.status];

          return (
            <View
              key={tx.id}
              style={[
                styles.txItem,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}>
              <View
                style={[styles.txIcon, { backgroundColor: iconColors.bg }]}>
                <Ionicons
                  name={isWalletTopup ? 'wallet' : tx.status === 'failed' ? 'close-circle' : 'layers'}
                  size={16}
                  color={iconColors.stroke}
                />
              </View>

              <View style={styles.txInfo}>
                <Text style={[styles.txName, { color: theme.text }]}>{tx.planName}</Text>
                <View style={styles.txSubRow}>
                  <Text style={[styles.txDate, { color: theme.textMuted }]}>
                    {formatDate(tx.date)}
                    {'  '}
                  </Text>
                  <View
                    style={[
                      styles.txBadge,
                      { backgroundColor: statusColor.bg },
                    ]}>
                    <Text
                      style={[
                        styles.txBadgeText,
                        { color: statusColor.text },
                      ]}>
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.txAmountWrap}>
                <Text
                  style={[styles.txAmount, { color: getAmountColor(tx) }]}>
                  {getAmountPrefix(tx)}₦{tx.amount.toLocaleString()}
                </Text>
                <Text style={[styles.txAmountSub, { color: theme.textMuted }]}>
                  {isWalletTopup
                    ? 'funding'
                    : tx.refunded
                      ? 'refunded'
                      : 'data'}
                </Text>
              </View>
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  pageTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  exportLink: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#6366F1',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  summaryCell: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 14,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: Fonts.numberBold,
    letterSpacing: -0.5,
  },
  filterRow: {
    paddingHorizontal: Spacing.three,
    gap: 8,
    marginBottom: Spacing.three,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
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
  txAmountWrap: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontFamily: Fonts.numberBold,
  },
  txAmountSub: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
});
