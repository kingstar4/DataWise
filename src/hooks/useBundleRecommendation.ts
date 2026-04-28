/**
 * Hook that recommends the best-value data bundle based on
 * the user's detected carrier and actual monthly data usage.
 */

import { useMemo } from 'react';

import {
  type CarrierId,
  type DataBundle,
  getMonthlyBundles,
  normalizeCarrierName,
} from '@/data/bundles';

// ── Types ──────────────────────────────────────────────────────────────────

export type BundleRecommendation = {
  /** The recommended data plan */
  bundle: DataBundle;
  /** The user's projected monthly usage in GB */
  projectedUsageGB: number;
  /** How much the user saves vs. the next more expensive plan (₦) */
  savingsNGN: number;
  /** Name of the plan being compared for savings */
  comparedPlanName: string;
  /** Normalized carrier ID */
  carrierId: CarrierId;
};

// ── Constants ──────────────────────────────────────────────────────────────

const GB = 1024 * 1024 * 1024;

/**
 * Multiplier to add a 20% buffer above projected usage.
 * This avoids recommending a plan the user will overshoot.
 */
const USAGE_BUFFER = 1.2;

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Recommends the best-value monthly data bundle for the user.
 *
 * @param carrierName - Raw carrier name from TelephonyManager
 * @param monthlyUsageBytes - Projected monthly data usage in bytes
 * @returns A recommendation, or null if carrier is unknown / no suitable plan
 */
export function useBundleRecommendation(
  carrierName: string,
  monthlyUsageBytes: number,
): BundleRecommendation | null {
  return useMemo(() => {
    // 1. Normalize carrier
    const carrierId = normalizeCarrierName(carrierName);
    if (!carrierId) return null;

    // 2. Get monthly plans for this carrier
    const monthlyPlans = getMonthlyBundles(carrierId);
    if (monthlyPlans.length === 0) return null;

    // 3. Project usage in GB with buffer
    const rawUsageGB = monthlyUsageBytes / GB;
    const bufferedUsageGB = rawUsageGB * USAGE_BUFFER;

    // 4. Find cheapest plan that covers the buffered usage
    const coveringPlans = monthlyPlans.filter(
      (p) => p.dataGB >= bufferedUsageGB,
    );

    let recommended: DataBundle;
    let comparedPlan: DataBundle | null = null;

    if (coveringPlans.length > 0) {
      // Cheapest plan that covers usage (already sorted by price asc)
      recommended = coveringPlans[0];

      // Compare against the next more expensive plan
      const nextIndex = coveringPlans.length > 1 ? 1 : null;
      comparedPlan = nextIndex !== null ? coveringPlans[nextIndex] : null;
    } else {
      // User's usage exceeds all plans — recommend the biggest available
      recommended = monthlyPlans[monthlyPlans.length - 1];

      // Compare with the next smaller plan to show savings per GB
      if (monthlyPlans.length > 1) {
        comparedPlan = monthlyPlans[monthlyPlans.length - 2];
      }
    }

    // 5. Calculate savings
    const savingsNGN = comparedPlan
      ? comparedPlan.priceNGN - recommended.priceNGN
      : 0;

    return {
      bundle: recommended,
      projectedUsageGB: Math.round(rawUsageGB * 100) / 100,
      savingsNGN: Math.max(0, savingsNGN),
      comparedPlanName: comparedPlan?.name ?? '',
      carrierId,
    };
  }, [carrierName, monthlyUsageBytes]);
}

// ── Utility ────────────────────────────────────────────────────────────────

/**
 * Estimate monthly usage from current period data.
 *
 * @param grandTotalBytes - Total bytes in the current period
 * @param period - "today" | "week" | "month"
 * @returns Estimated monthly usage in bytes
 */
export function projectMonthlyUsage(
  grandTotalBytes: number,
  period: 'today' | 'week' | 'month',
): number {
  switch (period) {
    case 'today':
      return grandTotalBytes * 30; // rough daily → monthly
    case 'week':
      return grandTotalBytes * 4.3; // weekly → monthly (~30/7)
    case 'month':
      return grandTotalBytes; // already monthly
  }
}
