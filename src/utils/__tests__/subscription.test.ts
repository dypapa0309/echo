jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorageMock from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { subscriptionUtils } from '../subscription';

describe('subscriptionUtils', () => {
  beforeEach(async () => {
    await AsyncStorageMock.clear();
  });

  it('starts as a free profile by default', async () => {
    const profile = await subscriptionUtils.getProfile();

    expect(profile.tier).toBe('free');
    expect(profile.expansionSaveCount).toBe(0);
  });

  it('tracks first memo creation and expansion save count', async () => {
    await subscriptionUtils.markMemoCreated(1710000000000);
    const updated = await subscriptionUtils.markExpansionSaved();

    expect(updated.firstMemoAt).toBe(1710000000000);
    expect(updated.expansionSaveCount).toBe(1);
  });

  it('recommends an upgrade after meaningful free usage', async () => {
    const profile = await subscriptionUtils.markMemoCreated(
      Date.now() - 8 * 24 * 60 * 60 * 1000
    );
    const recommendation = subscriptionUtils.getUpgradeRecommendation(profile, 30);

    expect(recommendation.shouldPrompt).toBe(true);
    expect(recommendation.headline.length).toBeGreaterThan(0);
  });
});
