import { supabase } from '@/lib/supabase';
import type { BundlePlan, Transaction } from '@/types/payments';
import { useCallback, useRef, useState } from 'react';

export type PurchaseStatus = 'idle' | 'processing' | 'success' | 'failed';

export type UsePurchaseReturn = {
  status: PurchaseStatus;
  error: string | null;
  transactionId: string | null;
  purchase: () => Promise<boolean>;
  reset: () => void;
};

export function usePurchase(
  plan: BundlePlan | null,
  walletBalance: number,
  deduct: (amount: number) => void,
  addTransaction: (tx: Transaction) => void,
): UsePurchaseReturn {
  const [status, setStatus] = useState<PurchaseStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
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

    // Optimistic deduction — Realtime will confirm the real balance
    deductedRef.current = plan.price;
    deduct(plan.price);

    // Generate idempotency key — prevents double charge on retry
    const idempotencyKey = `${plan.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('purchase-data', {
        body: {
          plan_id: String(plan.id),
          plan_name: plan.name,
          network: plan.network ?? plan.name.split(' ')[0], // extract network from name
          price_ngn: plan.price,
          idempotency_key: idempotencyKey,
          cheap_datahub_id: plan.cheapDataHubId,
        },
      });

      if (fnError) throw new Error(fnError.message);

      if (data.status === 'success') {
        setTransactionId(data.transaction_id);

        // Optimistic transaction record — Realtime will sync the real one
        addTransaction({
          id: data.transaction_id,
          planName: plan.name,
          amount: plan.price,
          status: 'success',
          type: 'data',
          date: new Date().toISOString(),
        });

        setStatus('success');
        return true;

      } else {
        // Edge function returned failure — wallet already restored server-side
        // Undo our optimistic deduction
        deduct(-deductedRef.current);
        deductedRef.current = 0;

        const errorMsg = data.error ?? 'Purchase failed. Your wallet has been refunded.';
        setError(errorMsg);
        setStatus('failed');

        addTransaction({
          id: data.transaction_id ?? `DW-FAIL-${Date.now()}`,
          planName: plan.name,
          amount: plan.price,
          status: 'failed',
          type: 'data',
          date: new Date().toISOString(),
          refunded: true,
        });

        return false;
      }

    } catch (e: any) {
      // Network error or unexpected failure
      // Undo optimistic deduction
      deduct(-deductedRef.current);
      deductedRef.current = 0;

      let errorMessage = 'Connection error. Please try again — your wallet has not been charged.';
      
      if (e.name === 'FunctionsHttpError' && e.context) {
        try {
          const body = await e.context.json();
          if (body?.error) {
            errorMessage = body.error;
          }
        } catch (_) {}
      }

      setError(errorMessage);
      setStatus('failed');

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