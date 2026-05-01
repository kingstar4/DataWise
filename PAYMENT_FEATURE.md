# DataWise — Payment Feature Spec

This file is the single source of truth for the payment feature
implementation. Execute in two phases as described below.

---

## Design constraints (never deviate from these)

- Background: `#0B1020` on all new screens
- Primary action: `#6366F1` (indigo)
- Success / money: `#10B981` (emerald)
- Warning: `#F59E0B`, Danger: `#EC4899`
- UI font: Plus Jakarta Sans, Number font: Space Grotesk
- Reuse existing: `HeroHeader`, `Card`, `Badge`, `SegmentedControl`,
  `AppUsageRow`, `ProgressBar`, `InsightCard`
- No new third-party libraries
- TypeScript strict mode throughout
- Dark navy background on every new screen — no light backgrounds

---

## Phase 1 — UI screens (local state only, no backend calls)

Build all screens with local/mock state. No Supabase calls yet.
Mark every future API call site with:
`// TODO(backend): replace with real call in Phase 2`

### Step 1 — Types

Create `src/types/payments.ts`:

```ts
export type BundlePlan = {
  id: string;
  name: string;       // e.g. "15 GB monthly"
  gb: number;
  price: number;      // NGN
  validity: number;   // days
  ussdCode: string;
  pricePerGb: number;
};

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

export type WalletState = {
  balance: number;
  transactions: Transaction[];
};
```

### Step 2 — Hooks (mock data, no network)

Create `src/hooks/useWallet.ts`:
- State: `balance` (start at 1200), `transactions` (use mock list below)
- Actions: `fund(amount: number)` adds to balance,
  `deduct(amount: number)` subtracts from balance,
  `addTransaction(tx: Transaction)` prepends to list
- Mock transactions: 5 items covering success/pending/failed states
- Mark fund() and deduct() with TODO(backend) comments

Create `src/hooks/usePurchase.ts`:
- Takes `plan: BundlePlan` and `walletBalance: number`
- State: `status: 'idle' | 'processing' | 'success' | 'failed'`
- `purchase()` action:
  1. Check balance >= plan.price, else return error
  2. Optimistically deduct from wallet
  3. TODO(backend): call Supabase Edge Function here
  4. Simulate 1.5s delay then resolve success in Phase 1
  5. On failure: restore wallet balance
- Returns: `{ purchase, status, error }`

### Step 3 — Screen: PlanPickerScreen

File: `src/app/plan-picker.tsx`

Layout (top to bottom):
1. `HeroHeader` — title "Buy data", subtitle shows carrier name
   from existing `getCarrierName()` native call
2. Projected usage row — "You're on track for X GB this month"
   pulled from `useBundleRecommendation` hook (already exists)
3. Section label "Recommended plans"
4. Plan cards list — map over `BUNDLE_PLANS` from
   `src/data/bundles.ts` filtered to current carrier, show top 3:
   - Card: plan name, price, validity tag, per-GB rate tag
   - Status tag: green "covers your usage" if plan.gb >=
     projectedGB * 1.2, red "may run short" if below
   - Radio selector on the right
   - "Best value" pill on the plan with lowest pricePerGb that
     covers projected usage (this is the pre-selected default)
5. InsightCard — "Why this plan?" explanation using projected GB
   and buffer calculation
6. Primary CTA button:
   - Disabled + grey until a plan is selected
   - When selected: "Buy [X] GB for ₦[price]"
   - onPress: navigate to `/wallet-fund` passing selected plan
7. Ghost button: "View transaction history" → `/transactions`

### Step 4 — Screen: WalletFundScreen

File: `src/app/wallet-fund.tsx`

Receives: `selectedPlan: BundlePlan` via route params

Layout:
1. Back button + "Fund wallet" title
2. Wallet balance card:
   - Balance in `#10B981`
   - Subtitle: if balance >= plan.price → "Ready — tap below to
     buy"; else → "Need ₦[gap] more for [plan name]"
3. "Top up amount" section — 4 quick-amount chips:
   ₦1,000 / ₦2,000 / ₦3,000 / ₦5,000
   - Pre-select the chip that brings balance to just above
     plan.price (smart default)
   - Custom amount TextInput below chips
   - Subtitle on wallet card updates live as amount changes
4. "Pay via" section — two selectable rows:
   - Paystack (selected by default): card icon, "Card or bank"
   - Bank transfer: "Direct to DataWise account"
5. Primary CTA: "Fund ₦[amount] and buy plan"
   onPress → navigate to `/confirm-purchase`
6. Ghost button: "Cancel" → go back

### Step 5 — Screen: ConfirmPurchaseScreen

File: `src/app/confirm-purchase.tsx`

Receives: `plan: BundlePlan`, `fundAmount: number` via route params

Layout:
1. Back button + "Confirm purchase" title
2. Plan summary card:
   - Large plan name + GB amount centred
   - Network name + "monthly plan"
   - Status badges: "Covers your usage" + "Best value"
3. Order detail rows (inside a Card):
   - Plan cost | ₦[price]
   - Wallet balance | ₦[currentBalance + fundAmount]
   - Deducted from wallet | ₦[price]
   - Remaining balance | ₦[balance - price] in `#10B981`
   - Delivery | "Instant" in `#10B981`
4. PIN entry section (inside a Card):
   - Label: "Confirm with PIN"
   - 4 dot indicators (unfilled → filled as digits entered)
   - Hint text below dots
   - Custom numpad grid (3×4): digits 1–9, empty, 0, backspace
   - On 4th digit: show "Verifying..." hint, 700ms delay,
     then call `purchase()` from usePurchase hook,
     then navigate to `/purchase-success` or show error

### Step 6 — Screen: PurchaseSuccessScreen

File: `src/app/purchase-success.tsx`

Receives: `plan: BundlePlan`, `transactionId: string`,
          `remainingBalance: number` via route params

Layout:
1. Centred success ring — circle with checkmark in `#10B981`
2. "Data activated!" title
3. Subtitle: "Your [X] GB [network] plan is live. DataWise will
   track your usage automatically."
4. Receipt card:
   - Plan | [name]
   - Amount paid | ₦[price]
   - Transaction ID | [id] in monospace, smaller text
   - Expires | [today + validity days formatted as "May 31, 2026"]
   - Remaining balance | ₦[amount] in `#6366F1`
5. Next refill prediction row (small card, indigo border):
   - Clock icon + "Based on your usage, you'll likely need your
     next top-up around [date]"
   - Calculate: today + (plan.gb / projectedDailyGB) days
6. Primary CTA: "View transaction history" → `/transactions`
7. Ghost button: "Back to dashboard" → `/` (home)

### Step 7 — Screen: TransactionHistoryScreen

File: `src/app/transactions.tsx`

Layout:
1. Header row: "Transactions" title + "Export" link (right, indigo)
2. 2×2 summary grid (use `StatBox` component):
   - Total spent (sum of successful data transactions)
   - Purchases (count)
   - Wallet balance (current)
   - Saved vs ad-hoc (mock: ₦2,100 for now, TODO backend)
3. Filter chips row (horizontal scroll):
   All / Data / Wallet top-up / Failed
   — filters the list below, active chip has indigo border + text
4. Transaction list — map over filtered transactions:
   - Icon: network/data icon (green bg for success, red for failed,
     amber for pending), wallet icon for topups
   - Info: plan name (bold), date + status badge
   - Status badge colours:
     success → `#10B981` on `#0a1f18`
     pending → `#F59E0B` on `#1a1508`
     failed  → `#EC4899` on `#1f0a12`
   - Amount: right-aligned, colour by type (white for data spend,
     green for wallet topup, pink for failed)
   - Failed transactions show "refunded" in subtitle

### Step 8 — Navigation

In `src/components/app-tabs.tsx`:
- Add a "Wallet" tab between "Usage" and whatever the last tab is
- Icon: a card/wallet SVG (use an icon from the existing icon set)
- Route: `/transactions`
- Active colour: `#6366F1`

In `src/app/_layout.tsx`:
- Register all 5 new screens in the router:
  `plan-picker`, `wallet-fund`, `confirm-purchase`,
  `purchase-success`, `transactions`
- Pass route params between screens using Expo Router's typed params

---

## Phase 2 — Backend wiring (run AFTER Phase 1 is visually complete)

Do not execute Phase 2 until explicitly asked.

### Supabase schema

Create migration `supabase/migrations/[timestamp]_payment_tables.sql`:

```sql
create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  balance integer not null default 0, -- stored in kobo (×100)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  plan_id text,
  plan_name text not null,
  amount integer not null,  -- NGN, stored in kobo
  type text not null check (type in ('data', 'wallet_topup')),
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  provider_ref text,        -- CheapDataHub transaction ID
  refunded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security
alter table wallets enable row level security;
alter table transactions enable row level security;

create policy "Users see own wallet"
  on wallets for all using (auth.uid() = user_id);

create policy "Users see own transactions"
  on transactions for all using (auth.uid() = user_id);
```

### Supabase Edge Function

Create `supabase/functions/purchase-data/index.ts`:

```
Flow:
1. Auth: verify JWT from request header
2. Read { planId, amount } from request body
3. Validate plan exists in the local BUNDLE_PLANS catalog
4. Fetch wallet row — verify balance >= plan.price
5. Create a 'pending' transaction record
6. Call CheapDataHub API:
   POST https://www.cheapdatahub.ng/api/[endpoint]
   Headers: { Authorization: Bearer CHEAPDATAHUB_API_KEY }
   Body: { plan_id, phone: userPhone, network }
7. On CheapDataHub success:
   - Deduct balance from wallet (use Postgres transaction)
   - Update transaction status to 'success'
   - Store provider_ref from CheapDataHub response
   - Return { success: true, transactionId, newBalance }
8. On CheapDataHub failure:
   - Update transaction status to 'failed', refunded = true
   - Do NOT deduct wallet
   - Return { success: false, error: message }

Secrets needed (set in Supabase dashboard):
  CHEAPDATAHUB_API_KEY
```

### Webhook handler

Create `supabase/functions/purchase-webhook/index.ts`:
- Receives POST from CheapDataHub on delivery confirmation
- Verify request authenticity (check shared secret header)
- Find transaction by `provider_ref`
- Update status to 'success' if still pending
- Update wallet balance if not already deducted

### Wire up hooks (replace TODO comments)

In `src/hooks/usePurchase.ts`:
- Replace the simulated delay with real Supabase function call:
  `supabase.functions.invoke('purchase-data', { body: {...} })`
- Handle error states from the function response

In `src/hooks/useWallet.ts`:
- Replace mock data with real Supabase queries:
  `supabase.from('wallets').select('balance').eq('user_id', uid)`
  `supabase.from('transactions').select('*').eq('user_id', uid)
   .order('created_at', { ascending: false })`
- Set up realtime subscription so balance updates live after
  webhook confirms delivery:
  `supabase.channel('wallet').on('postgres_changes', ...)`

---

## Checklist for agent to verify before marking complete

### Phase 1
- [ ] All 5 screens render without errors in Expo Go
- [ ] Carrier badge shows on plan picker
- [ ] Pre-selected plan is the best-value one covering projected usage
- [ ] CTA button is disabled until a plan is selected
- [ ] Wallet balance subtitle updates live on amount selection
- [ ] PIN dots fill on each numpad tap
- [ ] Success screen shows correct remaining balance
- [ ] Filter chips correctly filter the transaction list
- [ ] Wallet tab appears in bottom nav and routes to /transactions
- [ ] All TODO(backend) comments are in place

### Phase 2
- [ ] Supabase migration runs without errors
- [ ] RLS policies prevent cross-user data access
- [ ] Edge Function returns correct response for success case
- [ ] Edge Function returns correct response + no wallet deduction
      on CheapDataHub failure
- [ ] Realtime subscription updates balance without page refresh
- [ ] Webhook handler updates transaction status correctly
