import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { initializeAds } from "./ads-config";

export function BannerAdSlot() {
  const [unitId, setUnitId] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    void initializeAds().then((config) => {
      if (active) setUnitId(config.bannerAdUnitId);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (Platform.OS === "web" || !unitId) return null;
  return <View style={styles.container}><BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} /></View>;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", minHeight: 50, marginTop: 8, overflow: "hidden" },
});
