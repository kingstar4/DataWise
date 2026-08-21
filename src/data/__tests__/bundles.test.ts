import {
  getBundleByCheapDataHubId,
  getBundlesForCarrier,
  getMonthlyBundles,
  normalizeCarrierName,
} from '../bundles';

describe('normalizeCarrierName', () => {
  it.each([
    ['MTN', 'MTN'],
    ['mtn nigeria', 'MTN'],
    ['Airtel', 'Airtel'],
    ['Zain', 'Airtel'],
    ['Globacom', 'Glo'],
    ['9mobile', '9mobile'],
    ['Etisalat', '9mobile'],
  ] as const)('maps "%s" to %s', (raw, expected) => {
    expect(normalizeCarrierName(raw)).toBe(expected);
  });

  it('returns null for unrecognized carriers', () => {
    expect(normalizeCarrierName('Vodafone')).toBeNull();
    expect(normalizeCarrierName('')).toBeNull();
  });
});

describe('getBundlesForCarrier', () => {
  it('only returns bundles for the requested carrier', () => {
    const bundles = getBundlesForCarrier('MTN');
    expect(bundles.length).toBeGreaterThan(0);
    expect(bundles.every((b) => b.carrier === 'MTN')).toBe(true);
  });

  it('returns an empty array for 9mobile (no plans configured yet)', () => {
    expect(getBundlesForCarrier('9mobile')).toEqual([]);
  });
});

describe('getMonthlyBundles', () => {
  it('returns only monthly plans, sorted by price ascending', () => {
    const bundles = getMonthlyBundles('MTN');
    expect(bundles.every((b) => b.category === 'monthly')).toBe(true);

    const prices = bundles.map((b) => b.priceNGN);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });
});

describe('getBundleByCheapDataHubId', () => {
  it('finds a bundle by its CheapDataHub id', () => {
    const bundle = getBundleByCheapDataHubId(46); // MTN 1GB Monthly
    expect(bundle?.name).toBe('MTN 1GB Monthly');
  });

  it('returns undefined for an unknown id', () => {
    expect(getBundleByCheapDataHubId(-1)).toBeUndefined();
  });
});
