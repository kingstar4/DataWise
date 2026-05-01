/**
 * Purchase flow hook for DataWise payment feature.
 * Phase 1: simulates a 1.5s delay then resolves success. No real API calls.
 */

import { useCallback, useRef, useState } from 'react';

import type { BundlePlan, Transaction } from '@/types/payments';

// ── Types ──────────────────────────────────────────────────────────────────

export type PurchaseStatus = 'idle' | 'processing' | 'success' | 'failed';

export type UsePurchaseReturn = {
  status: PurchaseStatus;
  error: string | null;
  transactionId: string | null;
  purchase: () => Promise<boolean>;
  reset: () => void;
};

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Manages the purchase flow for a data bundle.
 *
 * @param plan - The selected bundle plan
 * @param walletBalance - Current wallet balance
 * @param deduct - Wallet deduct action
 * @param addTransaction - Action to add a transaction record
 */
export function usePurchase(
  plan: BundlePlan | null,
  walletBalance: number,
  deduct: (amount: number) => void,
  addTransaction: (tx: Transaction) => void,
): UsePurchaseReturn {
  const [status, setStatus] = useState<PurchaseStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Track the deducted amount so we can restore on failure
  const deductedRef = useRef(0);

  const purchase = useCallback(async (): Promise<boolean> => {
    if (!plan) {
      setError('No plan selected');
      setStatus('failed');
      return false;
    }

    if (walletBalance < plan.price) {
      setError(`Insufficient balance. Need ₦${(plan.price - walletBalance).toLocaleString()} more.`);
      setStatus('failed');
      return false;
    }

    setStatus('processing');
    setError(null);

    // Optimistically deduct from wallet
    deductedRef.current = plan.price;
    deduct(plan.price);

    try {
      // TODO(backend): replace with real call in Phase 2
      // Will call: supabase.functions.invoke('purchase-data', {
      //   body: { planId: plan.id, amount: plan.price }
      // })

      // Phase 1: simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Phase 1: always succeed
      const txId = `DW-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`;
      setTransactionId(txId);

      // Record transaction
      addTransaction({
        id: txId,
        planName: plan.name,
        amount: plan.price,
        status: 'success',
        type: 'data',
        date: new Date().toISOString(),
      });

      setStatus('success');
      return true;
    } catch {
      // On failure: restore wallet balance
      // TODO(backend): handle real API error responses in Phase 2
      deduct(-deductedRef.current); // restore by adding back
      deductedRef.current = 0;

      setError('Purchase failed. Your wallet has been refunded.');
      setStatus('failed');

      // Record failed transaction
      addTransaction({
        id: `DW-FAIL-${Date.now()}`,
        planName: plan.name,
        amount: plan.price,
        status: 'failed',
        type: 'data',
        date: new Date().toISOString(),
        refunded: true,
      });

      return false;
    }
  }, [plan, walletBalance, deduct, addTransaction]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTransactionId(null);
  }, []);

  return { status, error, transactionId, purchase, reset };
}
