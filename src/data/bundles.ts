/**
 * Local catalog of Nigerian carrier data bundles.
 *
 * Plans are sourced from official carrier USSD menus (as of April 2026).
 * Update this file when carriers change their pricing.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type CarrierId = 'MTN' | 'Airtel' | 'Glo' | '9mobile';

export type BundleCategory = 'daily' | 'weekly' | 'monthly';

export type DataBundle = {
  /** Unique identifier */
  id: string;
  /** Normalized carrier name */
  carrier: CarrierId;
  /** Human-readable plan name */
  name: string;
  /** Data allocation in GB */
  dataGB: number;
  /** Price in Nigerian Naira */
  priceNGN: number;
  /** Validity in days */
  validityDays: number;
  /** USSD code to purchase this plan */
  ussdCode: string;
  /** Plan category */
  category: BundleCategory;
  /** Cost per GB (auto-computed) */
  costPerGB: number;
};

// ── Carrier Name Normalization ─────────────────────────────────────────────

/**
 * Maps various carrier name strings returned by TelephonyManager
 * to our normalized CarrierId. Returns null if unrecognized.
 */
export function normalizeCarrierName(raw: string): CarrierId | null {
  const lower = raw.toLowerCase().trim();

  // MTN variations
  if (
    lower.includes('mtn') ||
    lower.includes('m.t.n') ||
    lower === '62130' // MTN Nigeria MCC-MNC
  ) {
    return 'MTN';
  }

  // Airtel variations
  if (
    lower.includes('airtel') ||
    lower.includes('econet') ||
    lower.includes('zain') ||
    lower === '62120'
  ) {
    return 'Airtel';
  }

  // Glo variations
  if (
    lower.includes('glo') ||
    lower.includes('globacom') ||
    lower === '62150'
  ) {
    return 'Glo';
  }

  // 9mobile variations
  if (
    lower.includes('9mobile') ||
    lower.includes('etisalat') ||
    lower.includes('emts') ||
    lower === '62160'
  ) {
    return '9mobile';
  }

  return null;
}

// ── Helper ─────────────────────────────────────────────────────────────────

function makeBundle(
  carrier: CarrierId,
  name: string,
  dataGB: number,
  priceNGN: number,
  validityDays: number,
  ussdCode: string,
  category: BundleCategory,
): DataBundle {
  return {
    id: `${carrier}-${category}-${dataGB}GB`.toLowerCase(),
    carrier,
    name,
    dataGB,
    priceNGN,
    validityDays,
    ussdCode,
    category,
    costPerGB: Math.round(priceNGN / dataGB),
  };
}

// ── MTN Plans ──────────────────────────────────────────────────────────────

const MTN_BUNDLES: DataBundle[] = [
  // Daily
  makeBundle('MTN', 'MTN 100MB Daily', 0.1, 100, 1, '*131*1*1*1#', 'daily'),
  makeBundle('MTN', 'MTN 200MB Daily', 0.2, 200, 1, '*131*1*1*2#', 'daily'),

  // Weekly
  makeBundle('MTN', 'MTN 750MB Weekly', 0.75, 500, 7, '*131*1*2*1#', 'weekly'),
  makeBundle('MTN', 'MTN 1GB Weekly', 1, 500, 7, '*131*1*2*2#', 'weekly'),

  // Monthly
  makeBundle('MTN', 'MTN 1.5GB Monthly', 1.5, 1000, 30, '*131*1*3*1#', 'monthly'),
  makeBundle('MTN', 'MTN 2GB Monthly', 2, 1200, 30, '*131*1*3*2#', 'monthly'),
  makeBundle('MTN', 'MTN 3GB Monthly', 3, 1500, 30, '*131*1*3*3#', 'monthly'),
  makeBundle('MTN', 'MTN 5GB Monthly', 5, 2500, 30, '*131*1*3*4#', 'monthly'),
  makeBundle('MTN', 'MTN 10GB Monthly', 10, 3500, 30, '*131*1*3*5#', 'monthly'),
  makeBundle('MTN', 'MTN 15GB Monthly', 15, 5000, 30, '*131*1*3*6#', 'monthly'),
  makeBundle('MTN', 'MTN 20GB Monthly', 20, 5500, 30, '*131*1*3*7#', 'monthly'),
];

// ── Airtel Plans ───────────────────────────────────────────────────────────

const AIRTEL_BUNDLES: DataBundle[] = [
  // Daily
  makeBundle('Airtel', 'Airtel 100MB Daily', 0.1, 100, 1, '*141*100#', 'daily'),
  makeBundle('Airtel', 'Airtel 200MB Daily', 0.2, 200, 1, '*141*200#', 'daily'),

  // Weekly
  makeBundle('Airtel', 'Airtel 750MB Weekly', 0.75, 500, 7, '*141*502#', 'weekly'),
  makeBundle('Airtel', 'Airtel 1.5GB Weekly', 1.5, 500, 14, '*141*504#', 'weekly'),

  // Monthly
  makeBundle('Airtel', 'Airtel 2GB Monthly', 2, 1200, 30, '*141*1200#', 'monthly'),
  makeBundle('Airtel', 'Airtel 3GB Monthly', 3, 1500, 30, '*141*1500#', 'monthly'),
  makeBundle('Airtel', 'Airtel 4.5GB Monthly', 4.5, 2000, 30, '*141*2000#', 'monthly'),
  makeBundle('Airtel', 'Airtel 6GB Monthly', 6, 2500, 30, '*141*2500#', 'monthly'),
  makeBundle('Airtel', 'Airtel 10GB Monthly', 10, 3000, 30, '*141*3000#', 'monthly'),
  makeBundle('Airtel', 'Airtel 20GB Monthly', 20, 5000, 30, '*141*5000#', 'monthly'),
];

// ── Glo Plans ──────────────────────────────────────────────────────────────

const GLO_BUNDLES: DataBundle[] = [
  // Daily
  makeBundle('Glo', 'Glo 150MB Daily', 0.15, 100, 1, '*127*51#', 'daily'),
  makeBundle('Glo', 'Glo 350MB Daily', 0.35, 200, 2, '*127*56#', 'daily'),

  // Weekly
  makeBundle('Glo', 'Glo 1.35GB Weekly', 1.35, 500, 14, '*127*57#', 'weekly'),

  // Monthly
  makeBundle('Glo', 'Glo 2.9GB Monthly', 2.9, 1000, 30, '*127*53#', 'monthly'),
  makeBundle('Glo', 'Glo 4.1GB Monthly', 4.1, 1500, 30, '*127*58#', 'monthly'),
  makeBundle('Glo', 'Glo 5.8GB Monthly', 5.8, 2000, 30, '*127*54#', 'monthly'),
  makeBundle('Glo', 'Glo 7.7GB Monthly', 7.7, 2500, 30, '*127*59#', 'monthly'),
  makeBundle('Glo', 'Glo 10GB Monthly', 10, 3000, 30, '*127*2#', 'monthly'),
  makeBundle('Glo', 'Glo 13.25GB Monthly', 13.25, 4000, 30, '*127*60#', 'monthly'),
  makeBundle('Glo', 'Glo 18.25GB Monthly', 18.25, 5000, 30, '*127*3#', 'monthly'),
];

// ── 9mobile Plans ──────────────────────────────────────────────────────────

const NINE_MOBILE_BUNDLES: DataBundle[] = [
  // Daily
  makeBundle('9mobile', '9mobile 100MB Daily', 0.1, 100, 1, '*229*3*1#', 'daily'),
  makeBundle('9mobile', '9mobile 250MB Daily', 0.25, 200, 1, '*229*3*2#', 'daily'),

  // Weekly
  makeBundle('9mobile', '9mobile 1GB Weekly', 1, 500, 7, '*229*2*1#', 'weekly'),

  // Monthly
  makeBundle('9mobile', '9mobile 1.5GB Monthly', 1.5, 1000, 30, '*229*2*12#', 'monthly'),
  makeBundle('9mobile', '9mobile 2GB Monthly', 2, 1200, 30, '*229*2*22#', 'monthly'),
  makeBundle('9mobile', '9mobile 3GB Monthly', 3, 1500, 30, '*229*2*8#', 'monthly'),
  makeBundle('9mobile', '9mobile 4.5GB Monthly', 4.5, 2000, 30, '*229*2*36#', 'monthly'),
  makeBundle('9mobile', '9mobile 11GB Monthly', 11, 4000, 30, '*229*2*5#', 'monthly'),
  makeBundle('9mobile', '9mobile 15GB Monthly', 15, 5000, 30, '*229*2*3#', 'monthly'),
];

// ── Aggregated Catalog ─────────────────────────────────────────────────────

/** All available bundles across all carriers. */
export const ALL_BUNDLES: DataBundle[] = [
  ...MTN_BUNDLES,
  ...AIRTEL_BUNDLES,
  ...GLO_BUNDLES,
  ...NINE_MOBILE_BUNDLES,
];

/**
 * Get all bundles for a specific carrier.
 */
export function getBundlesForCarrier(carrier: CarrierId): DataBundle[] {
  return ALL_BUNDLES.filter((b) => b.carrier === carrier);
}

/**
 * Get monthly bundles for a specific carrier, sorted by price ascending.
 */
export function getMonthlyBundles(carrier: CarrierId): DataBundle[] {
  return getBundlesForCarrier(carrier)
    .filter((b) => b.category === 'monthly')
    .sort((a, b) => a.priceNGN - b.priceNGN);
}
