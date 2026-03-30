export type BillingProvider = 'revenuecat';

export interface BillingProviderPlan {
  provider: BillingProvider;
  status: 'planned' | 'integrating' | 'active';
  summary: string;
  why: string;
}

export interface BillingReadiness {
  provider: BillingProvider;
  configured: boolean;
  missingKeys: string[];
  statusLabel: string;
  detail: string;
}

export interface BillingConnectionStatus {
  initialized: boolean;
  offeringsCount: number;
  activeEntitlements: string[];
  detail: string;
}

export interface BillingRestoreStatus {
  restored: boolean;
  activeEntitlements: string[];
  detail: string;
}

const readEnv = (key: string): string => {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return processLike.process?.env?.[key] ?? '';
};

const REVENUECAT_CONFIG = {
  iosApiKey: () => readEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY'),
  androidApiKey: () => readEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'),
};

export const BILLING_PROVIDER_PLAN: BillingProviderPlan = {
  provider: 'revenuecat',
  status: 'integrating',
  summary: 'Expo 개발 빌드 기반 구독 결제에 맞는 1순위 후보',
  why: 'Expo 문서와 RevenueCat 가이드 기준으로 개발 빌드에서 구독/IAP를 붙이기 가장 자연스럽고, StoreKit/Play Billing 복잡도를 줄여줍니다.',
};

export const billingUtils = {
  getRevenueCatReadiness(): BillingReadiness {
    const missingKeys: string[] = [];

    if (!REVENUECAT_CONFIG.iosApiKey().trim()) {
      missingKeys.push('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
    }

    if (!REVENUECAT_CONFIG.androidApiKey().trim()) {
      missingKeys.push('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');
    }

    if (missingKeys.length === 0) {
      return {
        provider: 'revenuecat',
        configured: true,
        missingKeys,
        statusLabel: '연결 준비 완료',
        detail: '공개 API 키가 모두 준비되어 있어 SDK 연결만 남았습니다.',
      };
    }

    return {
      provider: 'revenuecat',
      configured: false,
      missingKeys,
      statusLabel: '설정 필요',
      detail: `남은 키: ${missingKeys.join(', ')}`,
    };
  },

  async initializeRevenueCat(appUserID?: string): Promise<BillingConnectionStatus> {
    const readiness = billingUtils.getRevenueCatReadiness();
    if (!readiness.configured) {
      return {
        initialized: false,
        offeringsCount: 0,
        activeEntitlements: [],
        detail: readiness.detail,
      };
    }

    try {
      const { Platform } = require('react-native') as typeof import('react-native');
      const purchasesModule = await import('react-native-purchases');
      const Purchases = purchasesModule.default;
      const apiKey =
        Platform.OS === 'ios'
          ? REVENUECAT_CONFIG.iosApiKey()
          : REVENUECAT_CONFIG.androidApiKey();

      const logLevel = (purchasesModule as Record<string, unknown>).LOG_LEVEL as
        | { DEBUG?: unknown }
        | undefined;

      if (logLevel?.DEBUG !== undefined) {
        Purchases.setLogLevel(logLevel.DEBUG as never);
      }

      Purchases.configure({
        apiKey,
        appUserID,
        diagnosticsEnabled: true,
      });

      const [offerings, customerInfo] = await Promise.all([
        Purchases.getOfferings(),
        Purchases.getCustomerInfo(),
      ]);

      const activeEntitlements = Object.keys(
        customerInfo.entitlements?.active ?? {}
      );
      const offeringsCount = Object.keys(offerings.all ?? {}).length;

      return {
        initialized: true,
        offeringsCount,
        activeEntitlements,
        detail:
          offeringsCount > 0
            ? `오퍼링 ${offeringsCount}개를 읽었습니다.`
            : '연결은 되었지만 아직 오퍼링이 없습니다.',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'RevenueCat 연결에 실패했습니다.';
      return {
        initialized: false,
        offeringsCount: 0,
        activeEntitlements: [],
        detail: message,
      };
    }
  },

  async restoreRevenueCatPurchases(): Promise<BillingRestoreStatus> {
    const readiness = billingUtils.getRevenueCatReadiness();
    if (!readiness.configured) {
      return {
        restored: false,
        activeEntitlements: [],
        detail: readiness.detail,
      };
    }

    try {
      const purchasesModule = await import('react-native-purchases');
      const Purchases = purchasesModule.default;
      const customerInfo = await Purchases.restorePurchases();
      const activeEntitlements = Object.keys(customerInfo.entitlements?.active ?? {});

      return {
        restored: activeEntitlements.length > 0,
        activeEntitlements,
        detail:
          activeEntitlements.length > 0
            ? `복원된 권한 ${activeEntitlements.length}개를 확인했습니다.`
            : '복원할 구매 내역이 없었습니다.',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '구매 복원에 실패했습니다.';
      return {
        restored: false,
        activeEntitlements: [],
        detail: message,
      };
    }
  },
};
