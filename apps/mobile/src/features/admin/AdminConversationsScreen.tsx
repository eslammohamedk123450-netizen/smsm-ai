import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type Conversation = { id: string; user_id: string; title: string | null; created_at: string; updated_at: string };
type Profile = { id: string; email: string | null; full_name: string | null };
const PAGE_SIZE = 50;

export function AdminConversationsScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows, setRows] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dataAvailable, setDataAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);
  useEffect(() => { setPage(0); }, [debouncedSearch]);

  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const request = ++requestVersion.current;
    setLoading(true); setDataAvailable(false); setError(null);
    void adminService.getConversationsPage(page, PAGE_SIZE, debouncedSearch)
      .then((result) => {
        if (request !== requestVersion.current) return;
        setRows(result.conversations as Conversation[]);
        setProfiles(result.profiles as Record<string, Profile>);
        setTotal(result.total);
        setDataAvailable(true);
      })
      .catch(() => {
        if (request !== requestVersion.current) return;
        setRows([]); setProfiles({}); setTotal(0); setDataAvailable(false);
        setError("تعذر قراءة المحادثات. تحقق من صلاحية الأدمن وسياسات RLS.");
      })
      .finally(() => { if (request === requestVersion.current) setLoading(false); });
    return () => { requestVersion.current += 1; };
  }, [page, debouncedSearch, refreshKey]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? page * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return <View style={styles.screen}>
    <View style={styles.heading}>
      <View style={styles.headingCopy}>
        <Text style={styles.eyebrow}>مراقبة النشاط</Text>
        <Text style={styles.title}>المحادثات</Text>
        <Text style={styles.subtitle}>بيانات وصفية فقط · لا يُعرض محتوى المحادثة هنا</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => setRefreshKey((value) => value + 1)} style={styles.refresh}><Text style={styles.refreshText}>↻ تحديث</Text></Pressable>
    </View>
    <TextInput value={search} onChangeText={setSearch} placeholder="بحث بالعنوان أو البريد أو UUID" placeholderTextColor={colors.textMuted} style={styles.search} autoCapitalize="none" accessibilityLabel="بحث في المحادثات" />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 18 }} /> : null}
    {!loading && dataAvailable ? <Text style={styles.count}>عرض {from.toLocaleString("ar-EG")}–{to.toLocaleString("ar-EG")} من {total.toLocaleString("ar-EG")} محادثة</Text> : null}
    {!loading && dataAvailable && rows.length === 0 ? <Text style={styles.empty}>لا توجد محادثات مطابقة.</Text> : null}
    {dataAvailable && rows.length > 0 ? <ScrollView horizontal style={styles.table}>
      <View>
        <View style={styles.tableHead}>
          <Text style={[styles.cell, styles.titleCol]}>العنوان</Text>
          <Text style={[styles.cell, styles.userCol]}>المستخدم</Text>
          <Text style={[styles.cell, styles.idCol]}>UUID المحادثة</Text>
          <Text style={[styles.cell, styles.dateCol]}>آخر تحديث</Text>
        </View>
        <ScrollView>{rows.map((row) => <View key={row.id} style={styles.tableRow}>
          <Text style={[styles.cell, styles.titleCol, styles.primaryText]} numberOfLines={1}>{row.title?.trim() || "محادثة بدون عنوان"}</Text>
          <View style={[styles.cell, styles.userCol, styles.userInfo]}>
            <Text numberOfLines={1} style={styles.primaryText}>{profiles[row.user_id]?.full_name || profiles[row.user_id]?.email || "حساب المستخدم"}</Text>
            <Text selectable numberOfLines={1} style={styles.muted}>{row.user_id}</Text>
          </View>
          <Text selectable numberOfLines={1} style={[styles.cell, styles.idCol, styles.muted]}>{row.id}</Text>
          <Text style={[styles.cell, styles.dateCol, styles.muted]}>{new Date(row.updated_at).toLocaleString("ar-EG")}</Text>
        </View>)}</ScrollView>
      </View>
    </ScrollView> : null}
    {dataAvailable && pageCount > 1 ? <View style={styles.pagination}>
      <Pressable accessibilityRole="button" disabled={loading || page <= 0} onPress={() => setPage((value) => Math.max(0, value - 1))} style={[styles.pageButton, (loading || page <= 0) && styles.disabled]}><Text style={styles.pageText}>السابق</Text></Pressable>
      <Text style={styles.pageInfo}>صفحة {page + 1} من {pageCount}</Text>
      <Pressable accessibilityRole="button" disabled={loading || page + 1 >= pageCount} onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))} style={[styles.pageButton, (loading || page + 1 >= pageCount) && styles.disabled]}><Text style={styles.pageText}>التالي</Text></Pressable>
    </View> : null}
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
  error: { color: colors.error, fontSize: 10, textAlign: "right", padding: 8, backgroundColor: colors.surface, borderRadius: 7 },
  count: { color: colors.textMuted, fontSize: 9, textAlign: "right" },
  table: { flex: 1, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, backgroundColor: colors.surface },
  tableHead: { minWidth: 820, flexDirection: "row-reverse", backgroundColor: colors.surfaceElevated, borderBottomWidth: 1, borderColor: colors.divider },
  tableRow: { minWidth: 820, minHeight: 46, flexDirection: "row-reverse", alignItems: "center", borderBottomWidth: 1, borderColor: colors.divider },
  cell: { paddingHorizontal: 8, paddingVertical: 6, textAlign: "right", fontSize: 8, color: colors.textSecondary },
  titleCol: { width: 190 }, userCol: { width: 210 }, idCol: { width: 230 }, dateCol: { width: 190 },
  userInfo: { alignItems: "flex-end", gap: 2 },
  primaryText: { color: colors.textPrimary, fontWeight: "700" }, muted: { color: colors.textMuted },
  empty: { color: colors.textMuted, textAlign: "center", padding: 20, fontSize: 10 },
  pagination: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 7 },
  pageButton: { minHeight: 34, minWidth: 76, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.divider, borderRadius: 8, paddingHorizontal: 10 },
  pageText: { color: colors.textPrimary, fontSize: 10, fontWeight: "700" },
  pageInfo: { color: colors.textMuted, fontSize: 10 },
  disabled: { opacity: 0.45 },
});
