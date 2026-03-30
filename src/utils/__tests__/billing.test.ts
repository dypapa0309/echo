describe('billingUtils', () => {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const ORIGINAL_ENV = processLike.process?.env ?? {};

  beforeEach(() => {
    jest.resetModules();
    processLike.process = { env: { ...ORIGINAL_ENV } };
    delete processLike.process.env?.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    delete processLike.process.env?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  });

  afterAll(() => {
    processLike.process = { env: ORIGINAL_ENV };
  });

  it('reports missing RevenueCat keys when not configured', () => {
    const { billingUtils } = require('../billing');
    const readiness = billingUtils.getRevenueCatReadiness();

    expect(readiness.configured).toBe(false);
    expect(readiness.missingKeys).toEqual([
      'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
      'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
    ]);
  });

  it('reports readiness when both RevenueCat keys exist', () => {
    const env = processLike.process?.env ?? {};
    env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key';
    env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'android_key';
    processLike.process = { env };

    const { billingUtils } = require('../billing');
    const readiness = billingUtils.getRevenueCatReadiness();

    expect(readiness.configured).toBe(true);
    expect(readiness.missingKeys).toEqual([]);
  });
});
