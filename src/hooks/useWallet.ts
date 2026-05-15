import { supabase } from '@/lib/supabase';
import type { Transaction } from '@/types/payments';
import { useCallback, useEffect, useRef, useState } from 'react';

export type UseWalletReturn = {
  balance: number;
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  fund: (amount: number) => void;
  deduct: (amount: number) => void;
  addTransaction: (tx: Transaction) => void;
};

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    planName: (row.plan_name as string) ?? 'Wallet top-up',
    amount: Math.round((row.amount as number) / 100),
    status: row.status as Transaction['status'],
    type: row.type === 'wallet_topup' ? 'wallet_topup' : 'data',
    date: row.created_at as string,
    refunded: (row.refunded as boolean) ?? false,
  };
}

export function useWallet(): UseWalletReturn {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountIdRef = useRef(0);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (walletErr) {
      setError('Failed to load wallet');
      setLoading(false);
      return;
    }

    setBalance(Math.round((wallet.balance as number) / 100));

    const { data: txRows, error: txErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (txErr) {
      setError('Failed to load transactions');
      setLoading(false);
      return;
    }

    setTransactions((txRows ?? []).map(mapTransaction));
    setLoading(false);
  }, []);

  useEffect(() => {
    // Unique ID per mount — prevents channel name collisions with stale cleanups
    const mountId = ++mountIdRef.current;
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      // If cleanup already ran (React strict mode / fast remount), bail out
      if (cancelled || !user) return;

      fetchWallet();

      // Unique channel name per mount avoids "callbacks after subscribe" error
      const channel = supabase
        .channel(`wallet-live-${user.id}-${mountId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'wallets',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newBalance = payload.new as { balance: number };
            setBalance(Math.round(newBalance.balance / 100));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newTx = mapTransaction(payload.new as Record<string, unknown>);
            setTransactions((prev) => [newTx, ...prev]);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = mapTransaction(payload.new as Record<string, unknown>);
            setTransactions((prev) =>
              prev.map((tx) => (tx.id === updated.id ? updated : tx))
            );
          }
        )
        .subscribe();

      channelRef.current = channel;
    });

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchWallet]);

  const fund = useCallback((amount: number) => {
    setBalance((prev) => prev + amount);
  }, []);

  const deduct = useCallback((amount: number) => {
    setBalance((prev) => Math.max(0, prev - amount));
  }, []);

  const addTransaction = useCallback((tx: Transaction) => {
    setTransactions((prev) => [tx, ...prev]);
  }, []);

  return {
    balance,
    transactions,
    loading,
    error,
    refetch: fetchWallet,
    fund,
    deduct,
    addTransaction,
  };
}