import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { useSulyTheme } from "../../theme/ThemeProvider";
import { useAppLocale } from "../../theme/LocaleProvider";
import type { ThemePalette } from "../../theme/colors";
import { listTaskHistory, type TaskHistoryItem } from "../brain/task-service";

const STATUS_AR: Record<TaskHistoryItem["status"], string> = {
  queued: "في الانتظار",
  running: "قيد التنفيذ",
  completed: "مكتملة",
  failed: "تعذّر إكمالها",
  cancelled: "ملغاة",
};
const STATUS_EN: Record<TaskHistoryItem["status"], string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function TaskHistoryPanel() {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [items, setItems] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TaskHistoryItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setItems(await listTaskHistory(100)); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحميل سجل المهام." : "Could not load task history."));
    } finally { setLoading(false); }
  }, [isArabic]);

  useEffect(() => { void load(); }, [load]);

  const formatDate = (value: string | null) => value
    ? new Date(value).toLocaleString(isArabic ? "ar-EG" : "en-US")
    : (isArabic ? "غير متاح" : "Unavailable");

  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : error ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <Ionicons name="alert-circle-outline" size={28} color={colors.error} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error}</Text>
          <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.retryText, { color: colors.textPrimary }]}>{isArabic ? "إعادة المحاولة" : "Try again"}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <Ionicons name="git-branch-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{isArabic ? "لا توجد مهام محفوظة" : "No saved tasks yet"}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{isArabic ? "المهام التي تنفذها ستظهر هنا مع حالتها ونتيجتها." : "Your executed tasks will appear here with their status and result."}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable key={item.jobId} onPress={() => setSelected(item)} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
              <View style={[styles.icon, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name={item.status === "completed" ? "checkmark-circle-outline" : item.status === "failed" ? "alert-circle-outline" : "git-branch-outline"} size={19} color={colors.textPrimary} />
              </View>
              <View style={styles.copy}>
                <Text numberOfLines={2} style={[styles.objective, { color: colors.textPrimary }]}>{item.objective}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{formatDate(item.updatedAt)}</Text>
                {item.resultText ? <Text numberOfLines={2} style={[styles.preview, { color: colors.textSecondary }]}>{item.resultText}</Text> : null}
              </View>
              <View style={[styles.status, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.statusText, { color: colors.textSecondary }]}>{isArabic ? STATUS_AR[item.status] : STATUS_EN[item.status]}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <BottomSheet visible={Boolean(selected)} title={isArabic ? "تفاصيل المهمة" : "Task details"} onClose={() => setSelected(null)}>
        {selected ? (
          <View style={styles.details}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{isArabic ? "الطلب" : "Request"}</Text>
            <Text style={[styles.detailText, { color: colors.textPrimary }]}>{selected.objective}</Text>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{isArabic ? "الحالة" : "Status"}</Text>
            <Text style={[styles.detailText, { color: colors.textPrimary }]}>{isArabic ? STATUS_AR[selected.status] : STATUS_EN[selected.status]}</Text>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{isArabic ? "آخر تحديث" : "Last updated"}</Text>
            <Text style={[styles.detailText, { color: colors.textPrimary }]}>{formatDate(selected.updatedAt)}</Text>
            {selected.resultText ? <>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{isArabic ? "النتيجة" : "Result"}</Text>
              <Text selectable style={[styles.detailText, { color: colors.textPrimary }]}>{selected.resultText}</Text>
            </> : null}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  container: { flex: 1, minHeight: 180 },
  loading: { marginTop: 28 },
  list: { gap: 10, paddingBottom: 24 },
  row: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4, alignItems: isArabic ? "flex-end" : "flex-start" },
  objective: { fontSize: 13, fontWeight: "700", textAlign: isArabic ? "right" : "left" },
  meta: { fontSize: 10 },
  preview: { fontSize: 11, lineHeight: 17, textAlign: isArabic ? "right" : "left" },
  status: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  statusText: { fontSize: 9, fontWeight: "700" },
  empty: { alignItems: "center", justifyContent: "center", gap: 9, padding: 22, borderWidth: 1, borderRadius: 14, marginTop: 6 },
  emptyTitle: { fontSize: 14, fontWeight: "800" },
  emptyText: { fontSize: 12, textAlign: "center", lineHeight: 19 },
  retry: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  retryText: { fontSize: 12, fontWeight: "700" },
  details: { gap: 9, paddingBottom: 10 },
  detailLabel: { fontSize: 10, fontWeight: "700" },
  detailText: { fontSize: 13, lineHeight: 21, textAlign: isArabic ? "right" : "left" },
});
