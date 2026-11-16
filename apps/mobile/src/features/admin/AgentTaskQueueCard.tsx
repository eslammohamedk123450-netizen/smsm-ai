import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { adminService, type AgentTaskQueueOverview } from "./admin-service";

const STATUS_LABEL: Record<string, string> = {
  queued: "بالانتظار",
  running: "قيد التنفيذ",
  completed: "مكتملة",
  failed: "فشلت",
  cancelled: "ملغاة",
};

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AgentTaskQueueCard() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [overview, setOverview] = useState<AgentTaskQueueOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      setOverview(await adminService.getAgentTaskOverview());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل حالة قائمة المهام.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = overview ? [
    { label: "بالانتظار", value: overview.queued_count, color: colors.warning },
    { label: "تعمل الآن", value: overview.running_count, color: colors.primary },
    { label: "مكتملة", value: overview.completed_count, color: colors.success },
    { label: "فاشلة", value: overview.failed_count, color: colors.error },
  ] : [];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.title}>مراقبة مهام الوكيل</Text>
          <Text style={styles.subtitle}>قائمة التنفيذ الدائمة · آخر 20 مهمة دون عرض محتوياتها</Text>
        </View>
        <Pressable onPress={() => void load(true)} disabled={refreshing} style={styles.refresh}>
          <Text style={styles.refreshText}>{refreshing ? "تحديث…" : "↻ تحديث"}</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {overview ? (
        <>
          <View style={styles.metrics}>
            {metrics.map((item) => (
              <View key={item.label} style={styles.metric}>
                <Text style={[styles.value, { color: item.color }]}>{item.value.toLocaleString("ar-EG")}</Text>
                <Text style={styles.label}>{item.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>Leases منتهية: {overview.expired_lease_count.toLocaleString("ar-EG")}</Text>
            <Text style={styles.meta}>ملغاة: {overview.cancelled_count.toLocaleString("ar-EG")}</Text>
          </View>
          {overview.oldest_queued_at ? <Text style={styles.meta}>أقدم مهمة منتظرة: {dateLabel(overview.oldest_queued_at)}</Text> : null}
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>أحدث المهام</Text>
            <Text style={styles.meta}>{overview.recent_jobs.length.toLocaleString("ar-EG")} / 20</Text>
          </View>
          {overview.recent_jobs.slice(0, 8).map((job) => (
            <View key={job.id} style={styles.jobRow}>
              <View style={styles.jobCopy}>
                <Text style={styles.jobType}>{job.job_type}</Text>
                <Text style={styles.jobMeta}>محاولات {job.attempt_count}/{job.max_attempts} · {dateLabel(job.created_at)}</Text>
                {job.error_code ? <Text style={styles.errorCode}>{job.error_code}</Text> : null}
              </View>
              <Text style={[styles.status, job.status === "failed" ? styles.failed : job.status === "completed" ? styles.completed : job.status === "running" ? styles.running : styles.pending]}>
                {STATUS_LABEL[job.status] ?? job.status}
              </Text>
            </View>
          ))}
          <Text style={styles.generated}>آخر تحديث: {dateLabel(overview.generated_at)}</Text>
        </>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 13, gap: 10 },
  header: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },
  copy: { flex: 1, alignItems: "flex-end", gap: 3 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", textAlign: "right" },
  subtitle: { color: colors.textMuted, fontSize: 9, textAlign: "right" },
  refresh: { borderWidth: 1, borderColor: colors.divider, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6 },
  refreshText: { color: colors.primary, fontSize: 9, fontWeight: "800" },
  error: { color: colors.error, fontSize: 10, textAlign: "right" },
  metrics: { flexDirection: "row-reverse", gap: 7 },
  metric: { flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 8, padding: 9, alignItems: "center", gap: 3 },
  value: { fontSize: 18, fontWeight: "900" },
  label: { color: colors.textMuted, fontSize: 9 },
  metaRow: { flexDirection: "row-reverse", justifyContent: "space-between" },
  meta: { color: colors.textMuted, fontSize: 9, textAlign: "right" },
  recentHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 9 },
  sectionTitle: { color: colors.textPrimary, fontSize: 11, fontWeight: "800" },
  jobRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: 7 },
  jobCopy: { flex: 1, alignItems: "flex-end", gap: 2 },
  jobType: { color: colors.textSecondary, fontSize: 10, fontWeight: "800" },
  jobMeta: { color: colors.textMuted, fontSize: 8 },
  errorCode: { color: colors.error, fontSize: 8 },
  status: { fontSize: 9, fontWeight: "800" },
  failed: { color: colors.error },
  completed: { color: colors.success },
  running: { color: colors.primary },
  pending: { color: colors.warning },
  generated: { color: colors.textMuted, fontSize: 8, textAlign: "right" },
});
