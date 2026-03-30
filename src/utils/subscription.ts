import AsyncStorage from '@react-native-async-storage/async-storage';
import { BillingProfile, UpgradeRecommendation, PlanTier } from '../types';

const BILLING_PROFILE_KEY = 'echo:billing-profile';

const DEFAULT_PROFILE: BillingProfile = {
  tier: 'free',
  expansionSaveCount: 0,
};

const FREE_PLAN_THRESHOLDS = {
  memoCount: 24,
  expansionSaves: 4,
  activeDays: 7,
};

const parseProfile = (rawValue: string | null): BillingProfile => {
  if (!rawValue) {
    return { ...DEFAULT_PROFILE };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<BillingProfile>;
    return {
      tier: parsed.tier === 'pro' ? 'pro' : 'free',
      firstMemoAt:
        typeof parsed.firstMemoAt === 'number' ? parsed.firstMemoAt : undefined,
      expansionSaveCount:
        typeof parsed.expansionSaveCount === 'number' ? parsed.expansionSaveCount : 0,
      upgradeDismissedAt:
        typeof parsed.upgradeDismissedAt === 'number'
          ? parsed.upgradeDismissedAt
          : undefined,
    };
  } catch (error) {
    console.error('Failed to parse billing profile:', error);
    return { ...DEFAULT_PROFILE };
  }
};

const persistProfile = async (profile: BillingProfile) => {
  await AsyncStorage.setItem(BILLING_PROFILE_KEY, JSON.stringify(profile));
};

const diffDays = (startAt?: number, now = Date.now()) => {
  if (!startAt) {
    return 0;
  }

  return Math.max(0, Math.floor((now - startAt) / (1000 * 60 * 60 * 24)));
};

const buildUpgradeRecommendation = (
  profile: BillingProfile,
  memoCount: number,
  now = Date.now()
): UpgradeRecommendation => {
  if (profile.tier === 'pro') {
    return {
      shouldPrompt: false,
      headline: 'Echo Pro',
      detail: '현재 Pro 플랜을 사용 중입니다.',
    };
  }

  const activeDays = diffDays(profile.firstMemoAt, now);
  const shouldPrompt =
    memoCount >= FREE_PLAN_THRESHOLDS.memoCount ||
    profile.expansionSaveCount >= FREE_PLAN_THRESHOLDS.expansionSaves ||
    activeDays >= FREE_PLAN_THRESHOLDS.activeDays;

  if (!shouldPrompt) {
    return {
      shouldPrompt: false,
      headline: '무료 플랜',
      detail: '핵심 기록과 정리는 계속 무료로 사용할 수 있습니다.',
    };
  }

  if (profile.expansionSaveCount >= FREE_PLAN_THRESHOLDS.expansionSaves) {
    return {
      shouldPrompt: true,
      headline: '확장을 자주 쓰고 있어요',
      detail: '아이디어 확장을 여러 번 저장했다면 Pro 가치가 생기기 시작한 구간입니다.',
    };
  }

  if (memoCount >= FREE_PLAN_THRESHOLDS.memoCount) {
    return {
      shouldPrompt: true,
      headline: '메모가 충분히 쌓였어요',
      detail: '메모가 많이 쌓이면 Pro에서 정리와 검색 효율이 크게 좋아질 시점입니다.',
    };
  }

  return {
    shouldPrompt: true,
    headline: '계속 쓰고 있다면 Pro 타이밍입니다',
    detail: '일주일 이상 꾸준히 기록했다면 유료 전환 시점을 검토하기 좋은 구간입니다.',
  };
};

export const subscriptionUtils = {
  async getProfile(): Promise<BillingProfile> {
    const rawValue = await AsyncStorage.getItem(BILLING_PROFILE_KEY);
    return parseProfile(rawValue);
  },

  async markMemoCreated(createdAt = Date.now()): Promise<BillingProfile> {
    const current = await subscriptionUtils.getProfile();
    const nextProfile: BillingProfile = {
      ...current,
      firstMemoAt: current.firstMemoAt ?? createdAt,
    };
    await persistProfile(nextProfile);
    return nextProfile;
  },

  async markExpansionSaved(): Promise<BillingProfile> {
    const current = await subscriptionUtils.getProfile();
    const nextProfile: BillingProfile = {
      ...current,
      expansionSaveCount: current.expansionSaveCount + 1,
    };
    await persistProfile(nextProfile);
    return nextProfile;
  },

  async setTier(tier: PlanTier): Promise<BillingProfile> {
    const current = await subscriptionUtils.getProfile();
    const nextProfile: BillingProfile = {
      ...current,
      tier,
    };
    await persistProfile(nextProfile);
    return nextProfile;
  },

  getUpgradeRecommendation(
    profile: BillingProfile,
    memoCount: number,
    now = Date.now()
  ): UpgradeRecommendation {
    return buildUpgradeRecommendation(profile, memoCount, now);
  },
};
