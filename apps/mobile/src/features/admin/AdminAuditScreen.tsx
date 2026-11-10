import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";

type AuditRow = { id: string; admin_id: string; action: string; target_table: string | null; target_id: string | null; old_value?: unknown; new_value?: unknown; created_at: string };
type AdminProfile = { id: string; email?: string | null; full_name?: string | null };
const TYPES = ["الكل", "user_", "credit_", "model_", "provider_", "agent_", "plan_"] as const;
const PAGE_SIZE = 100;

export function AdminAuditScreen() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, AdminProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<string>("الكل");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true); setError(null);
    let query = supabase.from("admin_audit_logs")
      .select("id,admin_id,action,target_table,target_id,old_value,new_value,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (type !== "الكل") query = query.like("action", `${type}%`);
    if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
    if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);
    if (search.trim()) {
      const term = search.trim().replace(/[,()]/g, " ");
      query = query.or(`action.ilike.%${term}%,target_table.ilike.%${term}%,target_id.ilike.%${term}%`);
    }
    const { data, count, error: fetchError } = await query;
    if (fetchError) { setRows([]); setError("تعذر قراءة سجل النشاط. تحقق من صلاحية الأدمن وسياسات RLS."); setLoading(false); return; }
    const items = (data ?? []) as AuditRow[]; setRows(items); setTotal(count ?? 0);
    const ids = [...new Set(items.map((row) => row.admin_id).filter(Boolean))];
    if (ids.length) {
      const { data: people } = await supabase.from("suly_profiles").select("id,email,full_name").in("id", ids);
      setProfiles(Object.fromEntries(((people ?? []) as AdminProfile[]).map((person) => [person.id, person])));
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [page, type, from, to, search]);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.heading}><View style={styles.headingCopy}><Text style={styles.eyebrow}>تتبّع التغييرات</Text><Text style={styles.title}>سجل النشاط</Text><Text style={styles.subtitle}>منفّذ العملية · الإجراء · الهدف · التوقيت والقيم المسجلة.</Text></View><Pressable onPress={() => void load()} style={styles.refresh}><Text style={styles.refreshText}>↻ تحديث</Text></Pressable></View>
    <View style={styles.filters}><TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="بحث في المنفّذ أو النوع أو الهدف" placeholderTextColor={colors.textMuted} autoCapitalize="none" /><View style={styles.dateRow}><TextInput style={styles.date} value={from} onChangeText={setFrom} placeholder="من YYYY-MM-DD" placeholderTextColor={colors.textMuted} autoCapitalize="none" /><TextInput style={styles.date} value={to} onChangeText={setTo} placeholder="إلى YYYY-MM-DD" placeholderTextColor={colors.textMuted} autoCapitalize="none" /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>{TYPES.map((item) => <Pressable key={item} onPress={() => setType(item)} style={[styles.chip, item === type && styles.chipActive]}><Text style={[styles.chipText, item === type && styles.chipTextActive]}>{item === "الكل" ? item : item.replace("_", " · ")}</Text></Pressable>)}</ScrollView></View>
    <View style={styles.summary}><Text style={styles.summaryLabel}>النتائج</Text><Text style={styles.summaryValue}>{rows.length.toLocaleString("ar-EG")} <Text style={styles.summaryMuted}>من {total.toLocaleString("ar-EG")}</Text></Text></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : rows.length ? rows.map((row) => {
      const profile = profiles[row.admin_id];
      return <View key={row.id} style={styles.row}><View style={styles.rowHead}><View style={styles.actionBadge}><Text style={styles.actionText}>{row.action}</Text></View><Text style={styles.time}>{new Date(row.created_at).toLocaleString("ar-EG")}</Text></View><View style={styles.metaLine}><Text style={styles.metaLabel}>المنفّذ</Text><Text selectable style={styles.metaValue}>{profile?.full_name || profile?.email || row.admin_id || "—"}</Text></View><View style={styles.metaLine}><Text style={styles.metaLabel}>الهدف</Text><Text selectable style={styles.metaValue}>{row.target_table ?? "—"} · {row.target_id ?? "—"}</Text></View>{row.old_value || row.new_value ? <View style={styles.changeBlock}>{row.old_value ? <Text selectable style={styles.changeText}>قبل: {JSON.stringify(row.old_value)}</Text> : null}{row.new_value ? <Text selectable style={styles.changeText}>بعد: {JSON.stringify(row.new_value)}</Text> : null}</View> : null}</View>;
    }) : !loading ? <Text style={styles.empty}>لا توجد أحداث تطابق عوامل التصفية.</Text> : null}
    {!loading && total > PAGE_SIZE ? <View style={styles.pagination}><Pressable disabled={page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))} style={styles.pageButton}><Text style={styles.pageText}>السابق</Text></Pressable><Text style={styles.pageText}>{page + 1} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</Text><Pressable disabled={(page + 1) * PAGE_SIZE >= total} onPress={() => setPage((value) => value + 1)} style={styles.pageButton}><Text style={styles.pageText}>التالي</Text></Pressable></View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 14, gap: 9, maxWidth: 1100, width: "100%", alignSelf: "center" }, heading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 }, headingCopy: { flex: 1, alignItems: "flex-end", gap: 3 }, eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "800" }, title: { color: colors.textPrimary, fontSize: 20, fontWeight: "900" }, subtitle: { color: colors.textMuted, fontSize: 10, textAlign: "right" }, refresh: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 11 }, refreshText: { color: colors.textPrimary, fontSize: 10, fontWeight: "700" }, filters: { padding: 9, gap: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 9 }, search: { minHeight: 38, borderWidth: 1, borderColor: colors.divider, borderRadius: 7, paddingHorizontal: 10, color: colors.textPrimary, textAlign: "right", fontSize: 11 }, dateRow: { flexDirection: "row-reverse", gap: 7 }, date: { flex: 1, minHeight: 34, borderWidth: 1, borderColor: colors.divider, borderRadius: 7, paddingHorizontal: 8, color: colors.textPrimary, textAlign: "right", fontSize: 9 }, typeRow: { flexDirection: "row-reverse", gap: 6 }, chip: { borderWidth: 1, borderColor: colors.divider, borderRadius: 18, paddingHorizontal: 9, paddingVertical: 5 }, chipActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated }, chipText: { color: colors.textSecondary, fontSize: 9 }, chipTextActive: { color: colors.primary, fontWeight: "800" }, summary: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3 }, summaryLabel: { color: colors.textMuted, fontSize: 10 }, summaryValue: { color: colors.textPrimary, fontSize: 11, fontWeight: "800" }, summaryMuted: { color: colors.textMuted, fontSize: 9, fontWeight: "400" }, error: { color: colors.error, textAlign: "right", fontSize: 10 }, row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 9, padding: 10, gap: 6 }, rowHead: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 7, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingBottom: 6 }, actionBadge: { backgroundColor: colors.surfaceElevated, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4 }, actionText: { color: colors.primary, fontSize: 9, fontWeight: "800" }, time: { color: colors.textMuted, fontSize: 9 }, metaLine: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 8 }, metaLabel: { color: colors.textMuted, fontSize: 9 }, metaValue: { flex: 1, color: colors.textSecondary, fontSize: 9, textAlign: "right" }, changeBlock: { backgroundColor: colors.background, borderRadius: 6, padding: 7, gap: 3 }, changeText: { color: colors.textMuted, fontSize: 8, textAlign: "right" }, empty: { color: colors.textMuted, fontSize: 11, textAlign: "center", padding: 20 }, pagination: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 8 }, pageButton: { borderWidth: 1, borderColor: colors.divider, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 7 }, pageText: { color: colors.textSecondary, fontSize: 10, fontWeight: "700" } });
