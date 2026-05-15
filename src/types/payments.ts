/**
 * Payment feature types for DataWise.
 * Phase 1: used with local/mock state only.
 */

// ── Plan Types ─────────────────────────────────────────────────────────────

export type BundlePlan = {
  id: string;
  name: string;       // e.g. "15 GB monthly"
  gb: number;
  price: number;      // NGN (retail price charged to user)
  validity: number;   // days
  ussdCode: string;
  pricePerGb: number;
  network?: string;
  cheapDataHubId?: number;  // CheapDataHub bundle_id for API purchase
};

// ── Transaction Types ──────────────────────────────────────────────────────

export type TransactionStatus = 'success' | 'pending' | 'failed';
export type TransactionType = 'data' | 'wallet_topup';

export type Transaction = {
  id: string;
  planName: string;
  amount: number;     // NGN
  status: TransactionStatus;
  type: TransactionType;
  date: string;       // ISO string
  refunded?: boolean;
};

// ── Wallet Types ───────────────────────────────────────────────────────────

export type WalletState = {
  balance: number;
  transactions: Transaction[];
};
