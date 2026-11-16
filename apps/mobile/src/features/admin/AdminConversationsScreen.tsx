import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type Conversation = { id: string; user_id: string; title: string | null; created_at: string; updated_at: string };
type Profile = { id: string; email: string | null; full_name: string | null };

export function AdminConversationsScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows, setRows] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const pageSize = 50;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  useEffect(() => {
    const requestId = ++requestVersion.current;
    setLoading(true);
    setError(null);
    void adminService.getConversationsPage(page, pageSize, debouncedSearch)
      .then((result) => {
        if (requestId !== requestVersion.current) return;
        setRows(result.conversations as Conversation[]);
        setProfiles(result.profiles as Record<string, Profile>);
        setTotal(result.total);
        setAvailable(true);
      })
      .catch(() => {
        if (requestId !== requestVersion.current) return;
        setRows([]);
        setProfiles({});
        setTotal(0);
        setAvailable(false);
        setError("تعذر تحميل المحادثات. تحقق من صلاحيات الأدمن وسياسات RLS ثم أعد المحاولة.");
      })
      .finally(() => {
        if (requestId === requestVersion.current) setLoading(false);
      });
    return () => { requestVersion.current += 1; };
  }, [page, debouncedSearch, refreshKey]);

  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  return <View style={styles.screen}>
    <View style={styles.heading}>
      <View style={styles.headingCopy}>
        <Text style={styles.eyebrow}>مراقبة النشاط</Text>
        <Text style={styles.title}>المحادثات</Text>
        <Text style={styles.subtitle}>عرض بيانات وصفية فقط · لا يُعرض محتوى المحادثة هنا</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => setRefreshKey((value) => value + 1)} style={styles.refresh}>
        <Text style={styles.refreshText}>{loading ? "جارٍ التحديث…" : "↻ تحديث"}</Text>
      </Pressable>
    </View>
    <TextInput
      value={search}
      onChangeText={setSearch}
      placeholder="بحث بالعنوان أو البريد أو UUID"
      placeholderTextColor={colors.textMuted}
      style={styles.search}
      autoCapitalize="none"
      accessibilityLabel="بحث في المحادثات بالعنوان أو البريد أو المعرف"
      returnKeyType="search"
    />
    <Text style={styles.count}>{available ? `${total.toLocaleString("ar-EG")} محادثة · صفحة ${page + 1} من ${Math.max(1, lastPage + 1)}` : "عدد المحادثات غير متاح"}</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 18 }} /> : rows.length === 0 ? (
      <Text style={styles.empty}>{available ? "لا توجد محادثات مطابقة." : "تعذر عرض المحادثات."}</Text>
    ) : (
      <ScrollView horizontal style={styles.table}>
        <View>
          <View style={styles.tableHead}>
            <Text style={[styles.cell, styles.titleCol]}>العنوان</Text>
            <Text style={[styles.cell, styles.userCol]}>المستخدم</Text>
            <Text style={[styles.cell, styles.idCol]}>UUID المحادثة</Text>
            <Text style={[styles.cell, styles.dateCol]}>آخر تحديث</Text>
          </View>
          <ScrollView>
            {rows.map((row) => <View key={row.id} style={styles.tableRow}>
              <Text style={[styles.cell, styles.titleCol, styles.primaryText]} numberOfLines={1}>{row.title?.trim() || "محادثة بدون عنوان"}</Text>
              <View style={[styles.cell, styles.userCol, styles.userInfo]}>
                <Text numberOfLines={1} style={styles.primaryText}>{profiles[row.user_id]?.full_name || profiles[row.user_id]?.email || "حساب المستخدم"}</Text>
                <Text selectable numberOfLines={1} style={styles.muted}>{row.user_id}</Text>
              </View>
              <Text selectable numberOfLines={1} style={[styles.cell, styles.idCol, styles.muted]}>{row.id}</Text>
              <Text style={[styles.cell, styles.dateCol, styles.muted]}>{new Date(row.updated_at).toLocaleString("ar-EG")}</Text>
            </View>)}
          </ScrollView>
        </View>
      </ScrollView>
    )}
    <View style={styles.pagination}>
      <Pressable accessibilityRole="button" disabled={loading || page <= 0} onPress={() => setPage((value) => Math.max(0, value - 1))} style={[styles.pageButton, (loading || page <= 0) && styles.pageButtonDisabled]}>
        <Text style={styles.pageButtonText}>السابق</Text>
      </Pressable>
      <Text style={styles.pageInfo}>{available ? `${total.toLocaleString("ar-EG")} محادثة` : "البيانات غير متاحة"}</Text>
      <Pressable accessibilityRole="button" disabled={loading || page >= lastPage || !available} onPress={() => setPage((value) => Math.min(lastPage, value + 1))} style={[styles.pageButton, (loading || page >= lastPage || !available) && styles.pageButtonDisabled]}>
        <Text style={styles.pageButtonText}>التالي</Text>
      </Pressable>
    </View>
  </View>;
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 12, gap: 8 },
  heading: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 8 },
  headingCopy: { flex: 1, alignItems: "flex-end", gap: 2 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "800" },
  title: { color: colors.textPrimary, fontSize: 19, fontWeight: "900" },
  subtitle: { color: colors.textMuted, fontSize: 9 },
  refresh: { borderWidth: 1, borderColor: colors.divider, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7 },
  refreshText: { color: colors.textPrimary, fontSize: 9 },
  search: { minHeight: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 7, paddingHorizontal: 9, textAlign: "right", fontSize: 10, color: colors.textPrimary },
  count: { color: colors.textMuted, fontSize: 9, textAlign: "right" },
  error: { color: colors.error, fontSize: 10, textAlign: "right" },
  table: { flex: 1, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, backgroundColor: colors.surface },
  tableHead: { minWidth: 820, flexDirection: "row-reverse", backgroundColor: colors.surfaceElevated, borderBottomWidth: 1, borderColor: colors.divider },
  tableRow: { minWidth: 820, minHeight: 46, flexDirection: "row-reverse", alignItems: "center", borderBottomWidth: 1, borderColor: colors.divider },
  cell: { paddingHorizontal: 8, paddingVertical: 6, textAlign: "right", fontSize: 8, color: colors.textSecondary },
  titleCol: { width: 190 }, userCol: { width: 210 }, idCol: { width: 230 }, dateCol: { width: 190 },
  userInfo: { alignItems: "flex-end", gap: 2 },
  primaryText: { color: colors.textPrimary, fontWeight: "700" },
  muted: { color: colors.textMuted },
  empty: { color: colors.textMuted, textAlign: "center", padding: 20, fontSize: 10 },
  pagination: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: 8, padding: 8 },
  pageButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 7 },
  pageButtonDisabled: { opacity: 0.35 },
  pageButtonText: { color: colors.primary, fontSize: 9, fontWeight: "800" },
  pageInfo: { flex: 1, color: colors.textMuted, textAlign: "center", fontSize: 9 },
});
