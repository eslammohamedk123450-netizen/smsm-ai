import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { supportService } from "../support/support-service";

type FrictionRow = { event_day: string; event_kind: string; feature_key: string; screen_key: string; event_count: number; user_count: number; latest_at: string };
type FeedbackRow = { reaction: string; rating_count: number; latest_at: string };
const eventLabels: Record<string, string> = { screen_open: "فتح شاشة", task_start: "بدء مهمة", task_stuck: "تعثر أثناء المهمة", action_failed: "فشل إجراء", response_stopped: "إيقاف رد", upload_failed: "فشل رفع" };
const screenLabels: Record<string, string> = { chat: "المحادثة", media: "الوسائط", support: "الدعم", settings: "الإعدادات", hims: "HIMS", other: "أخرى" };

export function FrictionDashboardScreen() {
  const [friction, setFriction] = useState<FrictionRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [events, ratings] = await Promise.all([supportService.adminFrictionSummary(30), supportService.adminFeedbackSummary(30)]);
      setFriction(events as FrictionRow[]); setFeedback(ratings as FeedbackRow[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل المؤشرات."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const total = friction.reduce((sum, row) => sum + Number(row.event_count ?? 0), 0);
  const likes = Number(feedback.find((row) => row.reaction === "like")?.rating_count ?? 0);
  const dislikes = Number(feedback.find((row) => row.reaction === "dislike")?.rating_count ?? 0);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}><Text style={styles.title}>التقييمات ونقاط التعثر</Text><Pressable onPress={() => void load()}><Text style={styles.link}>تحديث</Text></Pressable></View>
    <Text style={styles.subtitle}>ملخص مجمّع لآخر 30 يومًا. لا يعرض نصوص المحادثات أو معرفات المستخدمين.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator color={colors.primary} /> : null}
    <View style={styles.grid}>
      <View style={styles.card}><Text style={styles.number}>{likes}</Text><Text style={styles.label}>إعجاب</Text></View>
      <View style={styles.card}><Text style={styles.number}>{dislikes}</Text><Text style={styles.label}>عدم إعجاب</Text></View>
      <View style={styles.card}><Text style={styles.number}>{total}</Text><Text style={styles.label}>أحداث تعثر</Text></View>
    </View>
    <View style={styles.section}><Text style={styles.sectionTitle}>الأحداث حسب اليوم والميزة</Text>
      {!loading && friction.length === 0 ? <Text style={styles.empty}>لا توجد أحداث مسجلة بعد. تظهر هنا بعد استخدام التطبيق.</Text> : friction.map((row, index) => <View key={`${row.event_day}-${row.event_kind}-${row.feature_key}-${index}`} style={styles.row}>
        <View style={styles.rowTop}><Text style={styles.value}>{row.event_count} حدث · {row.user_count} مستخدم</Text><Text style={styles.rowTitle}>{eventLabels[row.event_kind] ?? row.event_kind}</Text></View>
        <Text style={styles.meta}>{screenLabels[row.screen_key] ?? row.screen_key} · {row.feature_key} · {row.event_day}</Text>
      </View>)}
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 16, gap: 14 }, header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, title: { color: colors.textPrimary, fontSize: 23, fontWeight: "800" }, link: { color: colors.primary, fontWeight: "700" }, subtitle: { color: colors.textSecondary, textAlign: "right", lineHeight: 20 }, error: { color: colors.error, textAlign: "right" }, grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }, card: { flex: 1, minWidth: 110, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, alignItems: "flex-end", gap: 3 }, number: { color: colors.primary, fontSize: 24, fontWeight: "800" }, label: { color: colors.textSecondary, fontSize: 12 }, section: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, gap: 9 }, sectionTitle: { color: colors.textPrimary, textAlign: "right", fontSize: 17, fontWeight: "700" }, empty: { color: colors.textMuted, textAlign: "right" }, row: { borderTopWidth: 1, borderColor: colors.divider, paddingTop: 9, gap: 4 }, rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, rowTitle: { color: colors.textPrimary, fontWeight: "700", textAlign: "right" }, value: { color: colors.primary, fontWeight: "700" }, meta: { color: colors.textMuted, fontSize: 11, textAlign: "right" } });
