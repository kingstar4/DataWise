/**
 * Wallet state hook for DataWise payment feature.
 * Phase 1: local state with mock data. No backend calls.
 */

import { useCallback, useState } from 'react';

import type { Transaction, WalletState } from '@/types/payments';

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'DW-20260428-4412',
    planName: '10 GB MTN monthly',
    amount: 3500,
    status: 'success',
    type: 'data',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'DW-20260427-3301',
    planName: 'Wallet top-up',
    amount: 5000,
    status: 'success',
    type: 'wallet_topup',
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'DW-20260420-2287',
    planName: '5 GB Airtel monthly',
    amount: 2000,
    status: 'failed',
    type: 'data',
    date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    refunded: true,
  },
  {
    id: 'DW-20260415-1190',
    planName: '3 GB Glo weekly',
    amount: 1200,
    status: 'pending',
    type: 'data',
    date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'DW-20260410-0055',
    planName: 'Wallet top-up',
    amount: 3000,
    status: 'success',
    type: 'wallet_topup',
    date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_BALANCE = 1200;

// ── Hook ───────────────────────────────────────────────────────────────────

export type UseWalletReturn = {
  balance: number;
  transactions: Transaction[];
  fund: (amount: number) => void;
  deduct: (amount: number) => void;
  addTransaction: (tx: Transaction) => void;
};

export function useWallet(): UseWalletReturn {
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);

  const fund = useCallback((amount: number) => {
    // TODO(backend): replace with real call in Phase 2
    // Will call: supabase.from('wallets').update({ balance: newBalance })
    setBalance((prev) => prev + amount);
  }, []);

  const deduct = useCallback((amount: number) => {
    // TODO(backend): replace with real call in Phase 2
    // Will call: supabase.from('wallets').update({ balance: newBalance })
    setBalance((prev) => Math.max(0, prev - amount));
  }, []);

  const addTransaction = useCallback((tx: Transaction) => {
    // TODO(backend): replace with real call in Phase 2
    // Will call: supabase.from('transactions').insert(tx)
    setTransactions((prev) => [tx, ...prev]);
  }, []);

  return { balance, transactions, fund, deduct, addTransaction };
}
