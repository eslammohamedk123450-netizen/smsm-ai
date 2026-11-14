import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { colors } from "../../theme/colors";
import { adminService } from "./admin-service";

type ModelChoice = {
  id: number;
  name: string;
  model_identifier: string;
  provider_name: string;
  enabled: boolean;
  provider_enabled?: boolean;
  routing_group: string;
  health?: { auto_restricted?: boolean } | null;
};
type Role = "chat" | "planner" | "worker" | "reviewer" | "summarizer";
const ROLES: Array<[Role, string, string]> = [
  ["chat", "الدردشة", "الردود اليومية"],
  ["planner", "المخطط", "تقسيم المهام"],
  ["worker", "العامل", "تنفيذ الخطوات"],
  ["reviewer", "المراجع", "فحص الجودة"],
  ["summarizer", "الملخّص", "صياغة النتيجة"],
];

function typeLabel(model: ModelChoice): string {
  return model.routing_group === "paid_fallback" ? "مدفوع" : "مجاني";
}

export function RouteModelChainsCard({ models }: { models: ModelChoice[] }) {
  const [role, setRole] = useState<Role>("chat");
  const [chains, setChains] = useState<Record<Role, number[]>>({ chat: [], planner: [], worker: [], reviewer: [], summarizer: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const available = useMemo(() => models.filter((model) => model.enabled && model.provider_enabled !== false && model.routing_group !== "disabled" && !model.health?.auto_restricted), [models]);
  const currentIds = chains[role];
  const currentModels = currentIds.map((id) => models.find((model) => model.id === id)).filter(Boolean) as ModelChoice[];
  const availableToAdd = available.filter((model) => !currentIds.includes(model.id));

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const rows = await adminService.getRouteModelAssignments();
      const next: Record<Role, number[]> = { chat: [], planner: [], worker: [], reviewer: [], summarizer: [] };
      for (const row of rows) if (row.route_role in next && row.enabled) next[row.route_role as Role].push(Number(row.model_id));
      setChains(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل سلاسل التوجيه. طبّق migration 063 أولاً.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const save = async (nextIds: number[]) => {
    setSaving(true); setError(null); setNotice(null);
    try {
      await adminService.saveRouteModelAssignments(role, nextIds);
      setChains((current) => ({ ...current, [role]: nextIds }));
      setNotice("تم حفظ ترتيب هذه السلسلة.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ ترتيب السلسلة."); }
    finally { setSaving(false); }
  };
  const move = (index: number, delta: -1 | 1) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= currentIds.length) return;
    const next = [...currentIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    void save(next);
  };
  const add = (modelId: number) => void save([...currentIds, modelId]);
  const remove = (modelId: number) => void save(currentIds.filter((id) => id !== modelId));

  return <View style={styles.card}>
    <View style={styles.heading}><View style={styles.headingCopy}><Text style={styles.title}>سلاسل التوجيه</Text><Text style={styles.help}>اختر أكثر من نموذج لكل دور. يبدأ النظام بالأولوية ١ ولا ينتقل للتالي إلا عند الفشل أو انتهاء المهلة.</Text></View><Text style={styles.badge}>متسلسل</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>{ROLES.map(([value, label, hint]) => <Pressable key={value} onPress={() => { setRole(value); setNotice(null); }} style={[styles.roleChip, role === value && styles.roleChipActive]}><Text style={[styles.roleLabel, role === value && styles.roleLabelActive]}>{label}</Text><Text style={styles.roleHint}>{hint}</Text></Pressable>)}</ScrollView>
    {loading ? <ActivityIndicator color={colors.primary} /> : <>
      <View style={styles.chainHeader}><Text style={styles.sectionTitle}>{ROLES.find(([value]) => value === role)?.[1]} · ترتيب الأولوية</Text><Text style={styles.chainMeta}>{currentModels.length} نموذج</Text></View>
      {currentModels.length === 0 ? <Text style={styles.empty}>لا توجد سلسلة محفوظة لهذا الدور بعد.</Text> : currentModels.map((model, index) => <View key={model.id} style={styles.chainRow}><View style={styles.priority}><Text style={styles.priorityText}>{index + 1}</Text></View><View style={styles.modelCopy}><Text style={styles.modelName}>{model.name}</Text><Text style={styles.modelMeta}>{model.provider_name} · {typeLabel(model)} · {model.model_identifier}</Text></View><Pressable onPress={() => move(index, 1)} disabled={saving || index === currentModels.length - 1} style={styles.iconButton}><Text style={styles.iconText}>↓</Text></Pressable><Pressable onPress={() => move(index, -1)} disabled={saving || index === 0} style={styles.iconButton}><Text style={styles.iconText}>↑</Text></Pressable><Pressable onPress={() => remove(model.id)} disabled={saving} style={styles.removeButton}><Text style={styles.removeText}>إزالة</Text></Pressable></View>)}
      <Text style={styles.addTitle}>إضافة إلى السلسلة</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.addRow}>{availableToAdd.slice(0, 40).map((model) => <Pressable key={model.id} onPress={() => add(model.id)} disabled={saving} style={styles.addChip}><Text style={styles.addText}>+ {model.name}</Text><Text style={styles.addMeta}>{typeLabel(model)}</Text></Pressable>)}</ScrollView>
      {availableToAdd.length === 0 ? <Text style={styles.empty}>كل النماذج المؤهلة مضافة إلى هذه السلسلة.</Text> : null}
    </>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 12, gap: 10 },
  heading: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 9 }, headingCopy: { flex: 1, gap: 3, alignItems: "flex-end" }, title: { color: colors.textPrimary, fontWeight: "900", fontSize: 14, textAlign: "right" }, help: { color: colors.textMuted, fontSize: 10, lineHeight: 15, textAlign: "right" }, badge: { color: colors.primary, borderWidth: 1, borderColor: colors.primary, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: "800" },
  roleRow: { flexDirection: "row-reverse", gap: 7 }, roleChip: { minWidth: 92, borderWidth: 1, borderColor: colors.divider, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, alignItems: "flex-end", gap: 2 }, roleChipActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated }, roleLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: "800" }, roleLabelActive: { color: colors.primary }, roleHint: { color: colors.textMuted, fontSize: 8 },
  chainHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 9 }, sectionTitle: { color: colors.textPrimary, fontSize: 11, fontWeight: "800", textAlign: "right" }, chainMeta: { color: colors.textMuted, fontSize: 9 }, chainRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, padding: 7 }, priority: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" }, priorityText: { color: colors.primary, fontSize: 10, fontWeight: "900" }, modelCopy: { flex: 1, alignItems: "flex-end", gap: 2 }, modelName: { color: colors.textPrimary, fontSize: 10, fontWeight: "800", textAlign: "right" }, modelMeta: { color: colors.textMuted, fontSize: 8, textAlign: "right" }, iconButton: { width: 26, height: 26, borderWidth: 1, borderColor: colors.divider, borderRadius: 6, alignItems: "center", justifyContent: "center" }, iconText: { color: colors.textSecondary, fontSize: 14 }, removeButton: { borderWidth: 1, borderColor: colors.error, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5 }, removeText: { color: colors.error, fontSize: 8, fontWeight: "800" }, addTitle: { color: colors.textSecondary, fontSize: 10, textAlign: "right", fontWeight: "800", marginTop: 2 }, addRow: { flexDirection: "row-reverse", gap: 6 }, addChip: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, alignItems: "flex-end", gap: 2 }, addText: { color: colors.textSecondary, fontSize: 9, fontWeight: "700" }, addMeta: { color: colors.textMuted, fontSize: 8 }, empty: { color: colors.textMuted, fontSize: 9, textAlign: "right", paddingVertical: 4 }, error: { color: colors.error, fontSize: 10, textAlign: "right" }, notice: { color: colors.success, fontSize: 10, textAlign: "right" },
});
