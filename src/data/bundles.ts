/**
 * Local catalog of Nigerian carrier data bundles.
 *
 * Plans are sourced from CheapDataHub reseller API (as of May 2026).
 * Each plan has a `cheapDataHubId` that maps to CheapDataHub's `bundle_id`.
 * Retail prices include a markup over CheapDataHub wholesale cost.
 *
 * Update this file when CheapDataHub changes their plan catalog.
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
  /** Retail price in Nigerian Naira (what user pays) */
  priceNGN: number;
  /** Wholesale cost from CheapDataHub */
  costNGN: number;
  /** Validity in days */
  validityDays: number;
  /** USSD code to purchase this plan (fallback info) */
  ussdCode: string;
  /** Plan category */
  category: BundleCategory;
  /** Cost per GB (auto-computed from retail price) */
  costPerGB: number;
  /** CheapDataHub bundle_id for API purchase */
  cheapDataHubId: number;
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
  costNGN: number,
  validityDays: number,
  ussdCode: string,
  category: BundleCategory,
  cheapDataHubId: number,
): DataBundle {
  return {
    id: `${carrier}-${category}-${dataGB}GB-${cheapDataHubId}`.toLowerCase(),
    carrier,
    name,
    dataGB,
    priceNGN,
    costNGN,
    validityDays,
    ussdCode,
    category,
    costPerGB: dataGB > 0 ? Math.round(priceNGN / dataGB) : 0,
    cheapDataHubId,
  };
}

// ── MTN Plans ──────────────────────────────────────────────────────────────
// CheapDataHub IDs from plan catalog

const MTN_BUNDLES: DataBundle[] = [
  // Daily
  makeBundle('MTN', 'MTN 110MB Daily',   0.11,  120,   99,   1, '*131*1*1*1#', 'daily',   43),
  makeBundle('MTN', 'MTN 230MB Daily',   0.23,  250,  200,   1, '*131*1*1*2#', 'daily',   74),

  // Weekly
  makeBundle('MTN', 'MTN 1GB Weekly',    1,     550,  450,   7, '*131*1*2*2#', 'weekly',  45),
  makeBundle('MTN', 'MTN 2GB Weekly',    2,    1050,  930,   7, '*131*1*2*3#', 'weekly',  47),

  // Monthly
  makeBundle('MTN', 'MTN 500MB Monthly', 0.5,   450,  350,  30, '*131*1*3*0#', 'monthly', 44),
  makeBundle('MTN', 'MTN 1GB Monthly',   1,     700,  570,  30, '*131*1*3*1#', 'monthly', 46),
  makeBundle('MTN', 'MTN 2GB Monthly',   2,    1350, 1150,  30, '*131*1*3*2#', 'monthly', 48),
  makeBundle('MTN', 'MTN 3GB Monthly',   3,    1600, 1370,  30, '*131*1*3*3#', 'monthly', 49),
  makeBundle('MTN', 'MTN 5GB Monthly',   5,    2400, 2050,  30, '*131*1*3*4#', 'monthly', 50),
  makeBundle('MTN', 'MTN 7GB Monthly',   7,    3800, 3499,  30, '*131*1*3*5#', 'monthly', 33),
  makeBundle('MTN', 'MTN 10GB Monthly', 10,    5000, 4470,  30, '*131*1*3*6#', 'monthly', 67),
];

// ── Airtel Plans ───────────────────────────────────────────────────────────

const AIRTEL_BUNDLES: DataBundle[] = [
  // Daily
  makeBundle('Airtel', 'Airtel 1.5GB Daily', 1.5,   600,  500,   1, '*141*500#',  'daily',   69),

  // Weekly
  makeBundle('Airtel', 'Airtel 500MB Weekly', 0.5,   600,  490,   7, '*141*502#',  'weekly',  13),
  makeBundle('Airtel', 'Airtel 1GB Weekly',   1,     900,  785,   7, '*141*785#',  'weekly',  15),
  makeBundle('Airtel', 'Airtel 5GB Weekly',   5,    1800, 1570,   7, '*141*1570#', 'weekly',  52),

  // Monthly
  makeBundle('Airtel', 'Airtel 2GB Monthly',  2,    1700, 1470,  30, '*141*1200#', 'monthly', 17),
  makeBundle('Airtel', 'Airtel 3GB Monthly',  3,    2200, 1960,  30, '*141*1500#', 'monthly', 18),
  makeBundle('Airtel', 'Airtel 4GB Monthly',  4,    2900, 2570,  30, '*141*2000#', 'monthly', 19),
  makeBundle('Airtel', 'Airtel 8GB Monthly',  8,    3400, 2999,  30, '*141*3000#', 'monthly', 20),
  makeBundle('Airtel', 'Airtel 10GB Monthly',10,    4500, 4070,  30, '*141*5000#', 'monthly', 21),
];

// ── Glo Plans ──────────────────────────────────────────────────────────────

const GLO_BUNDLES: DataBundle[] = [
  // Daily
  makeBundle('Glo', 'Glo 200MB Daily',     0.2,   120,   89,   1, '*127*51#', 'daily',   42),

  // Weekly
  makeBundle('Glo', 'Glo 1GB Weekly',      1,     350,  280,   3, '*127*57#', 'weekly',  68),
  makeBundle('Glo', 'Glo 5GB Weekly',      5,    1900, 1690,   7, '*127*59#', 'weekly',  54),

  // Monthly
  makeBundle('Glo', 'Glo 500MB Monthly',   0.5,   300,  225,  30, '*127*52#', 'monthly', 35),
  makeBundle('Glo', 'Glo 1GB Monthly',     1,     550,  425,  30, '*127*53#', 'monthly', 36),
  makeBundle('Glo', 'Glo 2GB Monthly',     2,    1050,  840,  30, '*127*54#', 'monthly', 40),
  makeBundle('Glo', 'Glo 3GB Monthly',     3,    1500, 1290,  30, '*127*58#', 'monthly', 37),
  makeBundle('Glo', 'Glo 5GB Monthly',     5,    2500, 2190,  30, '*127*59#', 'monthly', 38),
  makeBundle('Glo', 'Glo 10GB Monthly',   10,    4800, 4390,  30, '*127*2#',  'monthly', 39),
  makeBundle('Glo', 'Glo 20.5GB Monthly',20.5,   5800, 5300,  30, '*127*3#',  'monthly', 59),
];

// ── 9mobile Plans ──────────────────────────────────────────────────────────
// Note: No 9mobile plans currently available on CheapDataHub.
// Plans listed here use placeholder CheapDataHub IDs (0) and will be
// rejected by the purchase endpoint until real IDs are configured.

const NINE_MOBILE_BUNDLES: DataBundle[] = [];

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

/**
 * Find a bundle by its CheapDataHub ID.
 */
export function getBundleByCheapDataHubId(id: number): DataBundle | undefined {
  return ALL_BUNDLES.find((b) => b.cheapDataHubId === id);
}
