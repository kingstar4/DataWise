import { renderHook } from '@testing-library/react-native';

import {
  projectMonthlyUsage,
  useBundleRecommendation,
} from '../useBundleRecommendation';

const GB = 1024 * 1024 * 1024;

describe('useBundleRecommendation', () => {
  it('returns null for an unrecognized carrier', async () => {
    const { result } = await renderHook(() =>
      useBundleRecommendation('Unknown Telco', 2 * GB),
    );
    expect(result.current).toBeNull();
  });

  it('recommends the cheapest MTN monthly plan that covers buffered usage', async () => {
    // 2GB usage * 1.2 buffer = 2.4GB -> cheapest covering plan is MTN 3GB Monthly (₦1520)
    const { result } = await renderHook(() =>
      useBundleRecommendation('MTN', 2 * GB),
    );

    expect(result.current).not.toBeNull();
    expect(result.current?.bundle.name).toBe('MTN 3GB Monthly');
    expect(result.current?.carrierId).toBe('MTN');
    expect(result.current?.projectedUsageGB).toBe(2);
  });

  it('compares savings against the next more expensive covering plan', async () => {
    const { result } = await renderHook(() =>
      useBundleRecommendation('MTN', 2 * GB),
    );

    // Next covering plan after MTN 3GB (₦1520) is MTN 5GB Monthly (₦2200)
    expect(result.current?.comparedPlanName).toBe('MTN 5GB Monthly');
    expect(result.current?.savingsNGN).toBe(2200 - 1520);
  });

  it('returns null when no catalog plan covers projected usage', async () => {
    // MTN's largest monthly plan is 10GB; 100GB usage can't be covered
    const { result } = await renderHook(() =>
      useBundleRecommendation('MTN', 100 * GB),
    );
    expect(result.current).toBeNull();
  });

  it('normalizes carrier name variants (case-insensitive, aliases)', async () => {
    const { result: airtel } = await renderHook(() =>
      useBundleRecommendation('econet', 1 * GB),
    );
    expect(airtel.current?.carrierId).toBe('Airtel');

    const { result: nineMobile } = await renderHook(() =>
      useBundleRecommendation('etisalat', 1 * GB),
    );
    // 9mobile has no monthly plans in the catalog
    expect(nineMobile.current).toBeNull();
  });

  it('filters livePlans by carrier when provided', async () => {
    const livePlans = [
      {
        id: 'x',
        carrier: 'MTN' as const,
        name: 'Live MTN 4GB',
        dataGB: 4,
        priceNGN: 1800,
        validityDays: 30,
        ussdCode: '*131#',
        costPerGB: 450,
        cheapDataHubId: 999,
      },
      {
        id: 'y',
        carrier: 'Glo' as const,
        name: 'Live Glo 4GB',
        dataGB: 4,
        priceNGN: 1700,
        validityDays: 30,
        ussdCode: '*127#',
        costPerGB: 425,
        cheapDataHubId: 998,
      },
    ];

    const { result } = await renderHook(() =>
      useBundleRecommendation('MTN', 2 * GB, livePlans),
    );

    expect(result.current?.bundle.name).toBe('Live MTN 4GB');
  });
});

describe('projectMonthlyUsage', () => {
  it('scales daily usage to a monthly projection', () => {
    expect(projectMonthlyUsage(100, 'today')).toBe(3000);
  });

  it('scales weekly usage to a monthly projection', () => {
    expect(projectMonthlyUsage(100, 'week')).toBeCloseTo(430);
  });

  it('passes through monthly usage unchanged', () => {
    expect(projectMonthlyUsage(500, 'month')).toBe(500);
  });
});
