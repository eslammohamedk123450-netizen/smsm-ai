import { Platform } from "react-native";
import mobileAds from "react-native-google-mobile-ads";
import { supabase } from "../../lib/supabase/client";

export type AdsConfig = {
  appId: string;
  rewardedAdUnitId: string;
  bannerAdUnitId: string;
};

const TEST_APP_ID = Platform.OS === "ios"
  ? "ca-app-pub-3940256099942544~1458002511"
  : "ca-app-pub-3940256099942544~3347511713";
const TEST_REWARDED_UNIT_ID = Platform.OS === "ios"
  ? "ca-app-pub-3940256099942544/1712485313"
  : "ca-app-pub-3940256099942544/5224354917";
const TEST_BANNER_UNIT_ID = Platform.OS === "ios"
  ? "ca-app-pub-3940256099942544/2934735716"
  : "ca-app-pub-3940256099942544/6300978111";

let configPromise: Promise<AdsConfig> | null = null;
let initialized = false;

export function getAdsConfig(): Promise<AdsConfig> {
  if (!configPromise) {
    configPromise = (async () => {
      const { data } = await supabase.from("system_settings")
        .select("key,value")
        .in("key", ["admob_app_id", "admob_rewarded_unit_id", "admob_banner_unit_id"])
        .limit(3);
      const rows = data ?? [];
      const values = new Map(rows.map((row) => [String(row.key), String(row.value ?? "").trim()]));
      const result = {
        appId: values.get("admob_app_id") || TEST_APP_ID,
        rewardedAdUnitId: values.get("admob_rewarded_unit_id") || TEST_REWARDED_UNIT_ID,
        bannerAdUnitId: values.get("admob_banner_unit_id") || TEST_BANNER_UNIT_ID,
      };
      // A pre-authenticated request can return no rows under RLS. Do not cache
      // that fallback; the authenticated ad components will retry from Supabase.
      if (rows.length === 0) configPromise = null;
      return result;
    })();
  }
  return configPromise;
}

export async function initializeAds(): Promise<AdsConfig> {
  const config = await getAdsConfig();
  if (Platform.OS !== "web" && !initialized) {
    await mobileAds().initialize();
    initialized = true;
  }
  return config;
}
