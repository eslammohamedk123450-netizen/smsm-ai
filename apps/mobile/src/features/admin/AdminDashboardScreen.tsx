import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";
import { confirmAdminAction } from "./admin-confirm";

type Model = { id: number; enabled: boolean; health?: { auto_restricted?: boolean; last_status?: string | null; total_attempts?: number; successful_attempts?: number; average_latency_ms?: number | null } | null };
type Tx = { amount: number | null; event_type: string; created_at: string };
type Audit = { id: string; admin_id: string; action: string; target_table: string | null; target_id: string | null; created_at: string };

function dateLabel(date: Date) { return date.toLocaleDateString("ar-EG", { weekday: "short" }); }
function valueText(value: number | null) { return value === null ? "—" : value.toLocaleString("ar-EG"); }

export function AdminDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [hourErrors, setHourErrors] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const [modelsResult, modelHealthResult, usersResult, errorsResult, transactionsResult, auditResult, maintenanceResult] = await Promise.all([
      supabase.from("ai_models").select("id,enabled").limit(500),
      supabase.from("ai_model_health").select("model_id,last_status,auto_restricted,total_attempts,successful_attempts,average_latency_ms").limit(1000),
      supabase.from("suly_profiles").select("id", { count: "exact", head: true }),
      supabase.from("ai_model_attempt_logs").select("id", { count: "exact", head: true }).gte("created_at", hourAgo).neq("attempt_status", "success"),
      supabase.from("suly_credit_transactions").select("amount,event_type,created_at").gte("created_at", since).order("created_at", { ascending: true }).limit(2000),
      supabase.from("admin_audit_logs").select("id,admin_id,action,target_table,target_id,created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("system_settings").select("value").eq("key", "maintenance_mode").maybeSingle(),
    ]);
    if (modelsResult.error || modelHealthResult.error || usersResult.error || errorsResult.error || transactionsResult.error || auditResult.error || maintenanceResult.error) setError("تعذر تحميل بعض مؤشرات التشغيل. اعرض تفاصيل المصدر أو تحقق من صلاحيات قاعدة البيانات.");
    const healthById = new Map((modelHealthResult.data ?? []).map((row) => [Number(row.model_id), row]));
    setModels(((modelsResult.data ?? []) as Model[]).map((model) => ({ ...model, health: healthById.get(Number(model.id)) ?? null })));
    setUserCount(usersResult.error ? null : usersResult.count ?? 0);
    setHourErrors(errorsResult.error ? null : errorsResult.count ?? 0);
    setTransactions((transactionsResult.data ?? []) as Tx[]);
    setAudit((auditResult.data ?? []) as Audit[]);
    setMaintenanceMode(maintenanceResult.data?.value === "true");
    // The app has no authoritative live-presence source; avoid presenting online users as zero.
    setOnlineCount(null);
    setLoading(false); setRefreshing(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const downModels = models.filter((model) => !model.enabled || model.health?.auto_restricted || model.health?.last_status === "error").length;
  const activeModels = Math.max(0, models.length - downModels);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayUsage = transactions.filter((row) => new Date(row.created_at) >= today && row.event_type === "settle").reduce((sum, row) => sum + Math.abs(Number(row.amount ?? 0)), 0);
  const chart = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); return { key: date.toISOString().slice(0, 10), label: dateLabel(date), total: 0 }; });
    for (const tx of transactions) { if (tx.event_type !== "settle") continue; const day = days.find((item) => item.key === tx.created_at.slice(0, 10)); if (day) day.total += Math.abs(Number(tx.amount ?? 0)); }
    return days;
  }, [transactions]);
  const maxChart = Math.max(1, ...chart.map((item) => item.total));
  const alerts = [
    ...models.filter((item) => !item.enabled || item.health?.auto_restricted || item.health?.last_status === "error").slice(0, 3).map((item) => ({ key: `model-${item.id}`, title: `نموذج متوقف أو متعثر: #${item.id}`, detail: "تحقق من حالة النموذج ومزود الخدمة.", path: "/admin/models" })),
    ...(hourErrors !== null && hourErrors >= 10 ? [{ key: "error-burst", title: `${valueText(hourErrors)} خطأ خلال آخر ساعة`, detail: "معدل الأخطاء مرتفع؛ راجع سجل صحة النماذج.", path: "/admin/models" }] : []),
  ];

  const toggleMaintenance = async () => {
    const next = !maintenanceMode;
    if (!await confirmAdminAction(next ? "تفعيل وضع الصيانة؟" : "إيقاف وضع الصيانة؟", next ? "سيُمنع المستخدمون من إرسال طلبات جديدة إلى النماذج حتى إيقاف الصيانة." : "سيعود استقبال الطلبات للمستخدمين.", next ? "تفعيل الصيانة" : "إيقاف الصيانة")) return;
    setMaintenanceBusy(true); setError(null);
    try {
      const { error: writeError } = await supabase.from("system_settings").upsert({ key: "maintenance_mode", value: String(next), is_sensitive: false }, { onConflict: "key" });
      if (writeError) throw writeError;
      setMaintenanceMode(next);
      await load(true);
    } catch { setError("تعذر تغيير وضع الصيانة. تحقق من ترحيل سجل التدقيق وصلاحية الأدمن."); }
    finally { setMaintenanceBusy(false); }
  };

  const metrics = [
    { title: "النماذج النشطة / المتوقفة", value: `${activeModels} / ${downModels}`, note: `${models.length} إجمالي النماذج`, path: "/admin/models", tone: downModels ? "warning" : "good" },
    { title: "المستخدمون أونلاين", value: onlineCount === null ? "—" : valueText(onlineCount), note: `${valueText(userCount)} إجمالي الحسابات · الحضور الحي غير مفعّل`, path: "/admin/users", tone: "neutral" },
    { title: "استهلاك اليوم", value: valueText(todayUsage), note: "رصيد مُسوّى · آخر 7 أيام محمّلة", path: "/admin/credit-management", tone: "neutral" },
    { title: "أخطاء آخر ساعة", value: valueText(hourErrors), note: "محاولات النماذج الفاشلة", path: "/admin/models", tone: hourErrors ? "warning" : "good" },
  ];

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.heading}><View style={styles.headingCopy}><Text style={styles.eyebrow}>نظرة تشغيلية مباشرة</Text><Text style={styles.title}>مركز تحكم الأدمن</Text><Text style={styles.subtitle}>مؤشرات الخدمة والإجراءات الإدارية في مساحة واحدة.</Text></View><Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.refresh}><Text style={styles.refreshText}>{refreshing ? "جارٍ التحديث…" : "↻ تحديث"}</Text></Pressable></View>
    {error ? <View style={styles.inlineWarning}><Text style={styles.inlineWarningText}>{error}</Text></View> : null}
    {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
    <View style={styles.metricGrid}>{metrics.map((metric) => <Pressable key={metric.title} accessibilityRole="button" onPress={() => router.push(metric.path)} style={styles.metric}><View style={styles.metricTop}><View style={[styles.metricDot, metric.tone === "warning" && styles.warningDot, metric.tone === "good" && styles.goodDot]} /><Text style={styles.metricLabel}>{metric.title}</Text></View><Text style={styles.metricValue}>{metric.value}</Text><Text style={styles.metricNote}>{metric.note}</Text></Pressable>)}</View>
    <View style={styles.quickHeader}><Text style={styles.sectionTitle}>إجراءات سريعة</Text><Text style={styles.sectionHint}>صلاحيات الأدمن · العمليات الحساسة تتطلب تأكيدًا داخل صفحاتها</Text></View>
    <View style={styles.quickActions}>
      <Pressable onPress={() => void toggleMaintenance()} style={[styles.quickAction, maintenanceMode && styles.quickDanger]}><Text style={styles.quickIcon}>{maintenanceMode ? "Ⅱ" : "⏻"}</Text><Text style={styles.quickText}>{maintenanceBusy ? "جارٍ التحديث…" : `الصيانة ${maintenanceMode ? "ON" : "OFF"}`}</Text></Pressable>
      <Pressable onPress={() => router.push("/admin/models")} style={styles.quickAction}><Text style={styles.quickIcon}>⏸</Text><Text style={styles.quickText}>إيقاف نموذج</Text></Pressable>
      <Pressable onPress={() => router.push("/admin/users")} style={styles.quickAction}><Text style={styles.quickIcon}>＋</Text><Text style={styles.quickText}>شحن رصيد</Text></Pressable>
      <Pressable onPress={() => router.push("/admin/models")} style={[styles.quickAction, styles.quickPrimary]}><Text style={[styles.quickIcon, styles.quickPrimaryText]}>✓</Text><Text style={[styles.quickText, styles.quickPrimaryText]}>اختبار شامل للنماذج</Text></Pressable>
    </View>
    <View style={styles.lowerGrid}>
      <View style={styles.panel}><View style={styles.panelHeading}><Text style={styles.sectionTitle}>استهلاك آخر 7 أيام</Text><Pressable onPress={() => router.push("/admin/credit-management")}><Text style={styles.link}>التفاصيل ←</Text></Pressable></View><View style={styles.chart}>{chart.map((item) => <Pressable key={item.key} onPress={() => router.push("/admin/credit-management")} style={styles.barColumn}><Text style={styles.barValue}>{item.total ? valueText(item.total) : "0"}</Text><View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(5, item.total / maxChart * 100)}%` }]} /></View><Text style={styles.barLabel}>{item.label}</Text></Pressable>)}</View><Text style={styles.chartFootnote}>تقدير مبني على معاملات `settle` المحمّلة؛ اضغط للانتقال إلى تفاصيل الرصيد.</Text></View>
      <View style={styles.panel}><View style={styles.panelHeading}><Text style={styles.sectionTitle}>آخر أحداث سجل النشاط</Text><Pressable onPress={() => router.push("/admin/audit")}><Text style={styles.link}>عرض السجل ←</Text></Pressable></View>{audit.length ? audit.map((item) => <Pressable key={item.id} onPress={() => router.push("/admin/audit")} style={styles.auditRow}><View style={styles.auditBullet} /><View style={styles.auditCopy}><Text style={styles.auditAction}>{item.action}</Text><Text style={styles.auditMeta}>{item.target_table ?? "—"} · {new Date(item.created_at).toLocaleString("ar-EG")}</Text></View></Pressable>) : <Text style={styles.emptyText}>لا توجد أحداث حديثة أو تعذر تحميلها.</Text>}</View>
    </View>
    <View style={styles.alertPanel}><View style={styles.panelHeading}><Text style={styles.sectionTitle}>التنبيهات التشغيلية</Text><Text style={[styles.alertCount, alerts.length ? styles.alertCountHot : styles.alertCountOk]}>{alerts.length ? `${alerts.length} يتطلب المراجعة` : "لا تنبيهات"}</Text></View>{alerts.length ? alerts.map((alert) => <Pressable key={alert.key} onPress={() => router.push(alert.path)} style={styles.alertRow}><View style={styles.alertMark} /><View style={styles.alertCopy}><Text style={styles.alertTitle}>{alert.title}</Text><Text style={styles.alertDetail}>{alert.detail}</Text></View><Text style={styles.link}>فتح ←</Text></Pressable>) : <Text style={styles.emptyText}>لا توجد حالات توقف ضمن المؤشرات المحمّلة.</Text>}</View>
    <Text style={styles.footer}>Suly · Admin only · الأرقام قابلة للفتح لعرض التفاصيل</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, gap: 13, maxWidth: 1200, width: "100%", alignSelf: "center" },
  heading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 }, headingCopy: { flex: 1, alignItems: "flex-end", gap: 3 }, eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 0.7 }, title: { color: colors.textPrimary, fontSize: 21, fontWeight: "900", textAlign: "right" }, subtitle: { color: colors.textMuted, fontSize: 11, textAlign: "right" }, refresh: { borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }, refreshText: { color: colors.textPrimary, fontSize: 11, fontWeight: "700" }, loader: { alignSelf: "flex-end" }, inlineWarning: { borderWidth: 1, borderColor: colors.error, borderRadius: 7, backgroundColor: colors.surface, padding: 9 }, inlineWarningText: { color: colors.error, fontSize: 11, textAlign: "right" },
  metricGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, metric: { flexGrow: 1, flexBasis: 210, minWidth: 145, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, gap: 5 }, metricTop: { flexDirection: "row-reverse", alignItems: "center", gap: 7 }, metricDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textMuted }, goodDot: { backgroundColor: colors.success }, warningDot: { backgroundColor: colors.error }, metricLabel: { flex: 1, color: colors.textSecondary, fontSize: 10, textAlign: "right" }, metricValue: { color: colors.textPrimary, fontSize: 24, fontWeight: "900", textAlign: "right", fontVariant: ["tabular-nums"] }, metricNote: { color: colors.textMuted, fontSize: 9, textAlign: "right" },
  quickHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 8 }, sectionTitle: { color: colors.textPrimary, fontWeight: "800", fontSize: 13, textAlign: "right" }, sectionHint: { color: colors.textMuted, fontSize: 9, textAlign: "right", flex: 1 }, quickActions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }, quickAction: { minHeight: 39, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, paddingHorizontal: 11, backgroundColor: colors.surface }, quickPrimary: { backgroundColor: colors.primary, borderColor: colors.primary }, quickDanger: { borderColor: colors.error, backgroundColor: "#281516" }, quickIcon: { color: colors.primary, fontSize: 13, fontWeight: "900" }, quickText: { color: colors.textPrimary, fontSize: 10, fontWeight: "700" }, quickPrimaryText: { color: "#07120D" },
  lowerGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9 }, panel: { flexGrow: 1, flexBasis: 340, minWidth: 260, padding: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, gap: 8 }, panelHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 }, link: { color: colors.accent, fontSize: 10, fontWeight: "700" }, chart: { minHeight: 112, flexDirection: "row-reverse", alignItems: "flex-end", justifyContent: "space-around", gap: 5, paddingTop: 5 }, barColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4, height: 100 }, barValue: { color: colors.textMuted, fontSize: 8, height: 12 }, barTrack: { height: 65, width: "70%", justifyContent: "flex-end", backgroundColor: colors.background, borderRadius: 4, overflow: "hidden" }, bar: { width: "100%", minHeight: 3, backgroundColor: colors.primary, borderRadius: 4 }, barLabel: { color: colors.textMuted, fontSize: 8 }, chartFootnote: { color: colors.textMuted, fontSize: 8, textAlign: "right" }, auditRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 7 }, auditBullet: { width: 6, height: 6, borderRadius: 4, backgroundColor: colors.primary }, auditCopy: { flex: 1, alignItems: "flex-end", gap: 2 }, auditAction: { color: colors.textPrimary, fontSize: 10, fontWeight: "700", textAlign: "right" }, auditMeta: { color: colors.textMuted, fontSize: 8, textAlign: "right" }, emptyText: { color: colors.textMuted, textAlign: "right", fontSize: 10, paddingVertical: 6 },
  alertPanel: { borderWidth: 1, borderColor: colors.divider, borderRadius: 10, backgroundColor: colors.surface, padding: 12, gap: 7 }, alertCount: { fontSize: 9, fontWeight: "700" }, alertCountHot: { color: colors.error }, alertCountOk: { color: colors.success }, alertRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 8, borderRadius: 7, backgroundColor: colors.background, borderWidth: 1, borderColor: "#753B3B" }, alertMark: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.error }, alertCopy: { flex: 1, alignItems: "flex-end" }, alertTitle: { color: colors.error, fontSize: 10, fontWeight: "800", textAlign: "right" }, alertDetail: { color: colors.textSecondary, fontSize: 9, textAlign: "right" }, footer: { color: colors.textMuted, fontSize: 8, textAlign: "right" },
});
