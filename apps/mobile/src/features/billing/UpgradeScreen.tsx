import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/auth-provider";

type Plan = { id: number; name: string; tier_key?: string | null; description: string | null; price: number; currency: string; billing_period: string; monthly_credits: number; daily_credits: number; max_requests: number; sort_order: number };
type Feature = { id: number; plan_id: number; title: string; value: string; sort_order: number };
const PLAN_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = { free: "sparkles-outline", basic: "leaf-outline", standard: "leaf-outline", lite: "flash-outline", pro: "rocket-outline", max: "diamond-outline", ultra: "infinite-outline", ultra_team: "people-outline" };
const planKey = (name: string) => {
  const value = name.trim().toLowerCase();
  if (value.includes("free")) return "free";
  if (value.includes("ultra team") || value.includes("ultra_team") || value === "team") return "ultra_team";
  if (value.includes("max")) return "max";
  if (value.includes("ultra")) return "ultra";
  if (value.includes("pro")) return "pro";
  if (value.includes("lite")) return "lite";
  return "free";
};

export default function UpgradeScreen() {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [currentTier, setCurrentTier] = useState("free");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    let [plansResult, featuresResult, tierResult] = await Promise.all([
      supabase.from("subscription_plans").select("id,name,tier_key,description,price,currency,billing_period,monthly_credits,daily_credits,max_requests,sort_order").eq("is_active", true).order("sort_order").limit(20),
      supabase.from("subscription_plan_features").select("id,plan_id,title,value,sort_order").eq("is_active", true).order("sort_order").limit(200),
      user ? supabase.rpc("suly_effective_subscription_tier", { p_user_id: user.id }) : Promise.resolve({ data: "free", error: null }),
    ]);
    if (plansResult.error) {
      const legacyPlans = await supabase.from("subscription_plans").select("id,name,description,price,currency,billing_period,monthly_credits,daily_credits,max_requests,sort_order").eq("is_active", true).order("sort_order").limit(20);
      if (!legacyPlans.error) plansResult = { ...legacyPlans, data: (legacyPlans.data ?? []).map((plan) => ({ ...plan, tier_key: planKey(plan.name) })) } as unknown as typeof plansResult;
    }
    if (plansResult.error || featuresResult.error || tierResult.error) setError(isArabic ? "تعذر تحميل الباقات أو التحقق من اشتراكك الحالي. حاول مرة أخرى." : "Could not load plans or verify your current subscription. Try again.");
    else {
      setPlans((plansResult.data ?? []) as Plan[]);
      setFeatures((featuresResult.data ?? []) as Feature[]);
      const effectiveTier = typeof tierResult.data === "string" ? tierResult.data : "free";
      setCurrentTier(effectiveTier.toLowerCase());
    }
    setLoading(false);
  }, [user, isArabic]);
  useEffect(() => { void load(); }, [load]);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>{isArabic ? "رجوع" : "Back"}</Text></Pressable><View style={styles.headerTitle}><Ionicons name="card-outline" size={25} color={colors.primary} /><Text style={styles.title}>{isArabic ? "الباقات والترقية" : "Plans & upgrades"}</Text></View></View>
    <Text style={styles.subtitle}>{isArabic ? "كل مستويات SULY ظاهرة للجميع. باقة Pro تفتح Lite وPro وMax، وباقة Max تفتحها جميعًا بالإضافة إلى SULY X عند اعتماده." : "All SULY models are visible to everyone. Pro unlocks Lite, Pro, and Max; Max also unlocks SULY X once it is approved."}</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <Text style={styles.error}>{error}</Text> : plans.map((plan) => {
      const key = plan.tier_key || planKey(plan.name);
      const current = currentTier === key;
      return <View key={plan.id} style={[styles.plan, current && styles.currentPlan]}>
        <View style={styles.planHeader}><View style={styles.planIdentity}><View style={styles.iconWrap}><Ionicons name={PLAN_ICONS[key] ?? "layers-outline"} size={25} color={colors.primary} /></View><Text style={styles.planName}>{plan.name}</Text></View><Text style={styles.price}>{plan.price === 0 ? (isArabic ? "مجانية" : "Free") : `${plan.price} ${plan.currency}`}</Text></View>
        {current ? <Text style={styles.currentBadge}>{isArabic ? "باقتك الحالية" : "Current plan"}</Text> : null}
        <Text style={styles.description}>{(isArabic ? (plan.description ?? "باقة مناسبة لاستخدامك") : key === "max" ? "For advanced work, deep analysis, and multi-step tasks." : key === "pro" ? "For coding, research, and complex everyday work." : "For everyday chats, questions, and writing.")}</Text>
        <Text style={styles.meta}>{isArabic ? `مستوى الخدمة: ${key === "ultra_team" ? "Ultra Team" : key.toUpperCase()}` : `Service level: ${key === "ultra_team" ? "Ultra Team" : key.toUpperCase()}`}</Text>
        <Text style={styles.meta}>{isArabic ? `الرصيد الشهري: ${Number(plan.monthly_credits ?? 0).toLocaleString("ar-EG")} · المهام: ${plan.max_requests.toLocaleString("ar-EG")}` : `Monthly credits: ${Number(plan.monthly_credits ?? 0).toLocaleString("en-US")} · Tasks: ${plan.max_requests.toLocaleString("en-US")}`}</Text>
        <View style={styles.features}>{features.filter((feature) => feature.plan_id === plan.id).map((feature) => <View key={feature.id} style={styles.feature}><Ionicons name="checkmark-circle" size={17} color={colors.primary} /><Text style={styles.featureValue}><Text style={styles.featureTitle}>{feature.title}: </Text>{feature.value}</Text></View>)}</View>
        <Pressable disabled={current || plan.price === 0} style={[styles.action, (current || plan.price === 0) && styles.disabled]}><Text style={styles.actionText}>{current ? (isArabic ? "باقتك الحالية" : "Current plan") : plan.price === 0 ? (isArabic ? "الباقة المجانية" : "Free plan") : (isArabic ? "ستتوفر الترقية قريبًا" : "Upgrades coming soon")}</Text></Pressable>
      </View>;
    })}
  </ScrollView>;
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 18, gap: 14, paddingBottom: 40 }, header: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" }, headerTitle: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 9 }, title: { color: colors.textPrimary, fontSize: 24, fontWeight: "800" }, back: { color: colors.primary, fontWeight: "700" }, subtitle: { color: colors.textSecondary, textAlign: isArabic ? "right" : "left", lineHeight: 22 }, error: { color: colors.error, textAlign: isArabic ? "right" : "left" }, plan: { backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }, currentPlan: { borderColor: colors.primary, borderWidth: 2 }, planHeader: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" }, planIdentity: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 9 }, iconWrap: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" }, planName: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" }, price: { color: colors.primary, fontSize: 16, fontWeight: "800" }, currentBadge: { alignSelf: "flex-end", color: colors.primary, fontWeight: "700", fontSize: 12 }, description: { color: colors.textSecondary, textAlign: isArabic ? "right" : "left", lineHeight: 20 }, meta: { color: colors.textMuted, textAlign: isArabic ? "right" : "left", fontSize: 12, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 9 }, features: { gap: 8 }, feature: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "flex-start", gap: 7 }, featureTitle: { color: colors.textPrimary, fontWeight: "700" }, featureValue: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", flex: 1, textAlign: isArabic ? "right" : "left", lineHeight: 19 }, action: { minHeight: 44, borderRadius: 14, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, marginTop: 3 }, disabled: { opacity: 0.55 }, actionText: { color: colors.onPrimary, fontWeight: "700" },
});
