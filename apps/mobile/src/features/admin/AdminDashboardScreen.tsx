import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";

interface Stat {
  key: string;
  label: string;
  hint: string;
  value: string;
  path: string;
}

async function countUsers(): Promise<number | null> {
  const { count, error } = await supabase.from("suly_profiles").select("id", { count: "exact", head: true });
  return error ? null : count ?? 0;
}

async function countEnabledModels(): Promise<number | null> {
  const { count, error } = await supabase.from("ai_models").select("id", { count: "exact", head: true }).eq("enabled", true);
  return error ? null : count ?? 0;
}

async function countProviders(): Promise<number | null> {
  const { count, error } = await supabase.from("ai_providers_catalog").select("id", { count: "exact", head: true });
  return error ? null : count ?? 0;
}

async function countConversations(): Promise<number | null> {
  const { count, error } = await supabase.from("suly_conversations").select("id", { count: "exact", head: true });
  return error ? null : count ?? 0;
}

export function AdminDashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([countUsers(), countEnabledModels(), countProviders(), countConversations()]);
    const value = (result: PromiseSettledResult<number | null>) => (result.status === "fulfilled" && result.value !== null ? String(result.value) : "—");
    setStats([
      { key: "users", label: "المستخدمون", hint: "إجمالي الحسابات المسجلة", value: value(results[0]), path: "/admin/users" },
      { key: "models", label: "النماذج المفعّلة", hint: "جاهزة للتوجيه التلقائي", value: value(results[1]), path: "/admin/models" },
      { key: "providers", label: "مزودو الخدمة", hint: "المفاتيح والمزامنة", value: value(results[2]), path: "/admin/api-keys" },
      { key: "conversations", label: "المحادثات", hint: "محفوظة في سجل المستخدمين", value: value(results[3]), path: "/admin/users" },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>نظرة عامة</Text>
          <Text style={styles.subtitle}>حالة النظام الآن. كل الأرقام تأتي من قاعدة البيانات مباشرة، وحدود الأمان تبقى في سياسات RLS ودوال RPC.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.refresh}>
          <Text style={styles.refreshText}>تحديث</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}

      <View style={styles.grid}>
        {stats.map((stat) => (
          <Pressable key={stat.key} accessibilityRole="button" onPress={() => router.push(stat.path)} style={styles.card}>
            <Text style={styles.cardValue}>{stat.value}</Text>
            <Text style={styles.cardLabel}>{stat.label}</Text>
            <Text style={styles.cardHint}>{stat.hint}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => router.push("/admin/api-keys")} style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>إضافة مزود خدمة</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/admin/hims")} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionText}>أكواد تفعيل HIMS</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/admin/support")} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionText}>صندوق الدعم والشكاوى</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/admin/friction")} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionText}>التقييمات ونقاط التعثر</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/chat")} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionText}>تجربة التطبيق</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>Suly Agent AI · Suly-Technologies</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 1000, alignSelf: "flex-start", padding: 20, gap: 18 },
  header: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerText: { flex: 1, gap: 6 },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: "800", textAlign: "right" },
  subtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 20, textAlign: "right" },
  refresh: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, backgroundColor: colors.surfaceElevated },
  refreshText: { color: colors.textPrimary, fontSize: 12 },
  loader: { alignSelf: "flex-start" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 },
  card: { flexGrow: 1, flexBasis: 200, minWidth: 180, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, gap: 4 },
  cardValue: { color: colors.textPrimary, fontSize: 26, fontWeight: "800", textAlign: "right" },
  cardLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "right" },
  cardHint: { color: colors.textMuted, fontSize: 11, textAlign: "right" },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  primaryAction: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryActionText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  secondaryAction: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" },
  secondaryActionText: { color: colors.textPrimary, fontSize: 13 },
  footer: { color: colors.textMuted, fontSize: 10, textAlign: "right", marginTop: 8 },
});
