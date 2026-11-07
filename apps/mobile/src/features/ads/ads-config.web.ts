export type AdsConfig = {
  appId: string;
  rewardedAdUnitId: string;
  bannerAdUnitId: string;
};

const WEB_ADS_CONFIG: AdsConfig = {
  appId: "",
  rewardedAdUnitId: "",
  bannerAdUnitId: "",
};

export async function getAdsConfig(): Promise<AdsConfig> {
  return WEB_ADS_CONFIG;
}

export async function initializeAds(): Promise<AdsConfig> {
  return WEB_ADS_CONFIG;
}
