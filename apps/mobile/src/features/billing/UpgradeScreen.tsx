import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { colors } from "../../theme/colors";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/auth-provider";

type Plan = { id: number; name: string; description: string | null; price: number; currency: string; billing_period: string; daily_credits: number; max_requests: number; sort_order: number };
type Feature = { id: number; plan_id: number; title: string; value: string; sort_order: number };
const PLAN_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = { free: "sparkles-outline", basic: "leaf-outline", standard: "leaf-outline", lite: "flash-outline", pro: "rocket-outline", max: "diamond-outline", ultra: "infinite-outline" };
const planKey = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

export default function UpgradeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [currentTier, setCurrentTier] = useState("free");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [plansResult, featuresResult, profileResult] = await Promise.all([
      supabase.from("subscription_plans").select("id,name,description,price,currency,billing_period,daily_credits,max_requests,sort_order").eq("is_active", true).order("sort_order").limit(20),
      supabase.from("subscription_plan_features").select("id,plan_id,title,value,sort_order").eq("is_active", true).order("sort_order").limit(200),
      user ? supabase.from("suly_profiles").select("subscription_tier").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (plansResult.error || featuresResult.error) setError("تعذر تحميل الباقات الآن. حاول مرة أخرى.");
    else {
      setPlans((plansResult.data ?? []) as Plan[]);
      setFeatures((featuresResult.data ?? []) as Feature[]);
      setCurrentTier(String(profileResult.data?.subscription_tier ?? user?.user_metadata?.subscription_tier ?? "free").toLowerCase());
    }
    setLoading(false);
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>رجوع</Text></Pressable><View style={styles.headerTitle}><Ionicons name="card-outline" size={25} color={colors.primary} /><Text style={styles.title}>الباقات والترقية</Text></View></View>
    <Text style={styles.subtitle}>اختر الباقة المناسبة لك. الرصيد هو الذي يحدد استخدام المحادثة والمهام.</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <Text style={styles.error}>{error}</Text> : plans.map((plan) => {
      const key = planKey(plan.name);
      const current = currentTier === key;
      return <View key={plan.id} style={[styles.plan, current && styles.currentPlan]}>
        <View style={styles.planHeader}><View style={styles.planIdentity}><View style={styles.iconWrap}><Ionicons name={PLAN_ICONS[key] ?? "layers-outline"} size={25} color={colors.primary} /></View><Text style={styles.planName}>{plan.name}</Text></View><Text style={styles.price}>{plan.price === 0 ? "مجانية" : `${plan.price} ${plan.currency}`}</Text></View>
        {current ? <Text style={styles.currentBadge}>باقتك الحالية</Text> : null}
        <Text style={styles.description}>{plan.description ?? "باقة مناسبة لاستخدامك"}</Text>
        <Text style={styles.meta}>الرصيد: {plan.daily_credits.toLocaleString("ar-EG")} · المهام: {plan.max_requests.toLocaleString("ar-EG")}</Text>
        <View style={styles.features}>{features.filter((feature) => feature.plan_id === plan.id).map((feature) => <View key={feature.id} style={styles.feature}><Ionicons name="checkmark-circle" size={17} color={colors.primary} /><Text style={styles.featureValue}><Text style={styles.featureTitle}>{feature.title}: </Text>{feature.value}</Text></View>)}</View>
        <Pressable disabled={current || plan.price === 0} style={[styles.action, (current || plan.price === 0) && styles.disabled]}><Text style={styles.actionText}>{current ? "باقتك الحالية" : plan.price === 0 ? "الباقة المجانية" : "ستتوفر الترقية قريبًا"}</Text></Pressable>
      </View>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 18, gap: 14, paddingBottom: 40 }, header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, headerTitle: { flexDirection: "row-reverse", alignItems: "center", gap: 9 }, title: { color: colors.textPrimary, fontSize: 24, fontWeight: "800" }, back: { color: colors.primary, fontWeight: "700" }, subtitle: { color: colors.textSecondary, textAlign: "right", lineHeight: 22 }, error: { color: colors.error, textAlign: "right" }, plan: { backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 }, currentPlan: { borderColor: colors.primary, borderWidth: 2 }, planHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, planIdentity: { flexDirection: "row-reverse", alignItems: "center", gap: 9 }, iconWrap: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" }, planName: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" }, price: { color: colors.primary, fontSize: 16, fontWeight: "800" }, currentBadge: { alignSelf: "flex-end", color: colors.primary, fontWeight: "700", fontSize: 12 }, description: { color: colors.textSecondary, textAlign: "right", lineHeight: 20 }, meta: { color: colors.textMuted, textAlign: "right", fontSize: 12, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 9 }, features: { gap: 8 }, feature: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 7 }, featureTitle: { color: colors.textPrimary, fontWeight: "700" }, featureValue: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", flex: 1, textAlign: "right", lineHeight: 19 }, action: { minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, marginTop: 3 }, disabled: { opacity: 0.55 }, actionText: { color: colors.background, fontWeight: "700" },
});
