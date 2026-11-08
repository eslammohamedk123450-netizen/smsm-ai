import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { randomUUID } from "expo-crypto";
import { useRewardedAd } from "react-native-google-mobile-ads";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";
import { initializeAds } from "./ads-config";

export function RewardAdButton() {
  const [unitId, setUnitId] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const rewardId = useRef<string | null>(null);
  const claimedRewardId = useRef<string | null>(null);
  const rewarded = useRewardedAd({ adUnitId: unitId, autoLoad: Boolean(unitId) });

  useEffect(() => {
    if (Platform.OS === "web") { setLoadingConfig(false); return; }
    let active = true;
    void initializeAds().then((config) => {
      if (active) setUnitId(config.rewardedAdUnitId);
    }).catch(() => {
      if (active) setMessage("الإعلانات غير متاحة حاليًا.");
    }).finally(() => {
      if (active) setLoadingConfig(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (busy && (rewarded.status === "closed" || rewarded.status === "error" || rewarded.status === "no-fill") && !rewarded.earnedReward) {
      setBusy(false);
      rewardId.current = null;
      setMessage(rewarded.status === "closed" ? "يجب إكمال الإعلان للحصول على المكافأة." : "تعذر تحميل الإعلان.");
      return;
    }
    if (!rewarded.earnedReward || !rewardId.current || claimedRewardId.current === rewardId.current) return;
    const currentRewardId = rewardId.current;
    claimedRewardId.current = currentRewardId;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("claim_rewarded_ad", { p_reward_id: currentRewardId });
        if (error) throw error;
        if (data?.success !== true) {
          claimedRewardId.current = null;
          setMessage(data?.error === "daily_reward_limit" ? "وصلت إلى حد مكافآت الإعلانات اليومي." : "تعذر إضافة المكافأة.");
          return;
        }
        setMessage(data.already_claimed ? "تم تسجيل هذه المكافأة من قبل." : "تمت إضافة 1000 رصيد إلى حسابك.");
      } catch {
        claimedRewardId.current = null;
        setMessage("اكتمل الإعلان، لكن تعذر تسجيل المكافأة. حاول مرة أخرى.");
      } finally {
        setBusy(false);
      }
    })();
  }, [busy, rewarded.earnedReward, rewarded.status]);

  const showRewardedAd = () => {
    if (busy || !unitId) return;
    setMessage(null);
    if (rewarded.status !== "loaded") {
      setMessage(rewarded.status === "no-fill" ? "لا يوجد إعلان متاح الآن." : "جارٍ تجهيز الإعلان، حاول بعد لحظة.");
      rewarded.retry();
      return;
    }
    rewardId.current = randomUUID();
    claimedRewardId.current = null;
    setBusy(true);
    rewarded.show();
  };

  if (Platform.OS === "web") return null;
  return <>
    <Pressable accessibilityRole="button" onPress={showRewardedAd} disabled={busy || loadingConfig} style={[styles.button, (busy || loadingConfig) && styles.disabled]}>
      {busy || loadingConfig ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>احصل على 1000 رصيد</Text>}
    </Pressable>
    {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
  </>;
}

const styles = StyleSheet.create({
  button: { minHeight: 44, borderRadius: 10, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 10 },
  disabled: { opacity: 0.55 },
  buttonText: { color: colors.textPrimary, fontWeight: "800", textAlign: "center" },
  message: { color: colors.textSecondary, fontSize: 12, textAlign: "center", marginTop: 5 },
});
