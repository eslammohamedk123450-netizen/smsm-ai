import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { colors } from "../../theme/colors";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/auth-provider";

type Plan = { id: number; name: string; description: string | null; price: number; currency: string; billing_period: string; daily_credits: number; max_requests: number; sort_order: number };
type Feature = { id: number; plan_id: number; title: string; value: string; sort_order: number };

export default function UpgradeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [plansResult, featuresResult] = await Promise.all([
      supabase.from("subscription_plans").select("id,name,description,price,currency,billing_period,daily_credits,max_requests,sort_order").eq("is_active", true).order("sort_order").limit(20),
      supabase.from("subscription_plan_features").select("id,plan_id,title,value,sort_order").eq("is_active", true).order("sort_order").limit(200),
    ]);
    if (plansResult.error || featuresResult.error) setError("تعذر تحميل الباقات الآن. حاول مرة أخرى.");
    else { setPlans((plansResult.data ?? []) as Plan[]); setFeatures((featuresResult.data ?? []) as Feature[]); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>رجوع</Text></Pressable><Text style={styles.title}>ترقية الحساب</Text></View>
    <Text style={styles.subtitle}>اختر الباقة المناسبة لك. الأسعار والمزايا محدثة من لوحة التحكم.</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <Text style={styles.error}>{error}</Text> : plans.map((plan) => {
      const current = user?.user_metadata?.subscription_tier && String(user.user_metadata.subscription_tier).toLowerCase() === plan.name.toLowerCase();
      return <View key={plan.id} style={[styles.plan, current && styles.currentPlan]}>
        <View style={styles.planHeader}><Text style={styles.planName}>{plan.name}</Text><Text style={styles.price}>{plan.price === 0 ? "مجانية" : `${plan.price} ${plan.currency}`}</Text></View>
        <Text style={styles.description}>{plan.description ?? "باقة مناسبة لاستخدامك"}</Text>
        <Text style={styles.meta}>رصيد يومي: {plan.daily_credits.toLocaleString("ar-EG")} · حد الطلبات: {plan.max_requests.toLocaleString("ar-EG")}</Text>
        <View style={styles.features}>{features.filter((feature) => feature.plan_id === plan.id).map((feature) => <View key={feature.id} style={styles.feature}><Text style={styles.featureTitle}>{feature.title}</Text><Text style={styles.featureValue}>{feature.value}</Text></View>)}</View>
        <Pressable disabled={current || plan.price === 0} style={[styles.action, (current || plan.price === 0) && styles.disabled]}><Text style={styles.actionText}>{current ? "باقتك الحالية" : plan.price === 0 ? "الباقة المجانية" : "ستتوفر الترقية قريبًا"}</Text></Pressable>
      </View>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 18, gap: 12, paddingBottom: 36 }, header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, title: { color: colors.textPrimary, fontSize: 24, fontWeight: "800" }, back: { color: colors.primary, fontWeight: "700" }, subtitle: { color: colors.textSecondary, textAlign: "right", lineHeight: 21 }, error: { color: colors.error, textAlign: "right" }, plan: { backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 18, padding: 16, gap: 9 }, currentPlan: { borderColor: colors.primary, borderWidth: 2 }, planHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, planName: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" }, price: { color: colors.primary, fontSize: 17, fontWeight: "800" }, description: { color: colors.textSecondary, textAlign: "right" }, meta: { color: colors.textMuted, textAlign: "right", fontSize: 12 }, features: { gap: 7, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 }, feature: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 12 }, featureTitle: { color: colors.textSecondary, fontSize: 12 }, featureValue: { color: colors.textPrimary, fontSize: 12, fontWeight: "600", flex: 1, textAlign: "right" }, action: { minHeight: 42, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, marginTop: 4 }, disabled: { opacity: 0.55 }, actionText: { color: colors.background, fontWeight: "700" },
});
