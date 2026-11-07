import { Platform } from "react-native";
import { supabase } from "../../lib/supabase/client";

// Web build: react-native-google-mobile-ads ships native-only code and cannot be
// bundled for the web target, so this variant exposes the same API without it.
// Ads remain a native-only feature; the web app simply never renders them.
export type AdsConfig = {
  appId: string;
  rewardedAdUnitId: string;
  bannerAdUnitId: string;
};

const TEST_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const TEST_REWARDED_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";
const TEST_BANNER_UNIT_ID = "ca-app-pub-3940256099942544/6300978111";

let configPromise: Promise<AdsConfig> | null = null;

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
      if (rows.length === 0) configPromise = null;
      return result;
    })();
  }
  return configPromise;
}

export async function initializeAds(): Promise<AdsConfig> {
  void Platform.OS;
  return getAdsConfig();
}