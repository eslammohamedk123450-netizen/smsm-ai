import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { adminService, type AgentConfig } from "./admin-service";

type AgentRole = "coordinator" | "planner" | "thinker" | "worker" | "reviewer" | "summarizer";
type ModelOption = {
  id: number;
  name: string;
  model_identifier: string;
  provider_name: string;
  enabled: boolean;
  routing_group: string;
  task_roles?: string[] | null;
  health?: { auto_restricted?: boolean } | null;
};

const ROLES: Array<{ key: AgentRole; label: string; description: string; eligibilityRole: "planner" | "worker" | "reviewer" | "summarizer" }> = [
  { key: "coordinator", label: "المدير / المنسق المركزي", description: "ينظم عمل الوكيل الواحد ويتابع الخطة والميزانية.", eligibilityRole: "planner" },
  { key: "planner", label: "المخطط", description: "يحلل الطلب ويقسمه إلى خطوات واعتماديات.", eligibilityRole: "planner" },
  { key: "thinker", label: "المفكر / المحلل", description: "يدعم التحليل والاستدلال داخل الوكيل المركزي.", eligibilityRole: "planner" },
  { key: "worker", label: "المنفذ / العامل", description: "ينفذ خطوة محددة بالأدوات والصلاحيات المسموحة.", eligibilityRole: "worker" },
  { key: "reviewer", label: "المراجع", description: "يراجع جودة التنفيذ والنتائج قبل التسليم.", eligibilityRole: "reviewer" },
  { key: "summarizer", label: "الملخص", description: "يصوغ النتيجة النهائية للمستخدم.", eligibilityRole: "summarizer" },
];

function supportsRole(model: ModelOption, role: AgentRole): boolean {
  const required = ROLES.find((item) => item.key === role)?.eligibilityRole ?? "planner";
  const roles = model.task_roles?.length ? model.task_roles : ["general"];
  return model.enabled === true
    && model.routing_group !== "disabled"
    && model.health?.auto_restricted !== true
    && (roles.includes("general") || roles.includes(required) || (required === "worker" && roles.includes("executor")));
}

export function AgentRoleProfilesAdminCard() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [profiles, setProfiles] = useState<AgentConfig[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [role, setRole] = useState<AgentRole>("coordinator");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfilePrompt, setNewProfilePrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [profileRows, overview] = await Promise.all([
        adminService.getAgents(),
        adminService.getModelsOverview(),
      ]);
      setProfiles(profileRows);
      setModels((overview.models ?? []) as ModelOption[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل ملفات أدوار الوكيل والنماذج.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const currentProfile = profiles.find((profile) => profile.role === role && profile.is_active)
    ?? profiles.find((profile) => profile.role === role)
    ?? null;

  useEffect(() => {
    setSelectedIds(currentProfile?.model_fallback_chain ?? []);
    setNotice(null);
  }, [currentProfile?.id, currentProfile?.updated_at, role]);

  const eligibleModels = useMemo(() => models.filter((model) => supportsRole(model, role)), [models, role]);
  const query = search.trim().toLocaleLowerCase();
  const availableModels = eligibleModels.filter((model) =>
    !selectedIds.includes(String(model.id))
    && (!query || `${model.name} ${model.model_identifier} ${model.provider_name}`.toLocaleLowerCase().includes(query))
  ).slice(0, 40);

  const save = async () => {
    if (!currentProfile) {
      setError("لا يوجد ملف دور محفوظ لهذا الدور. لم يتم إنشاء ملف تلقائي حتى لا نفرض تعليمات غير معتمدة.");
      return;
    }
    setSaving(true); setError(null); setNotice(null);
    try {
      await adminService.updateAgent(currentProfile.id, {
        name: currentProfile.name,
        systemPrompt: currentProfile.system_prompt,
        modelFallbackChain: selectedIds,
        isActive: currentProfile.is_active,
      });
      setNotice("تم حفظ ترتيب النماذج المفضلة لهذا الدور. يظل التوجيه المركزي والأهلية والميزانية هي المرجع النهائي.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ تفضيلات النماذج.");
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setSelectedIds(next);
  };

  const add = (id: string) => {
    if (!selectedIds.includes(id) && selectedIds.length < 20) setSelectedIds((current) => [...current, id]);
  };

  return <View style={styles.card}>
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text style={styles.title}>ملفات أدوار الوكيل المركزي</Text>
        <Text style={styles.description}>تفضيلات النماذج لكل دور داخل عقل SULY الواحد؛ هذه القائمة لا تمنح صلاحيات أو تتجاوز أهلية التوجيه أو حدود الرصيد.</Text>
      </View>
      <Pressable onPress={() => void load()}><Ionicons name="refresh-outline" size={19} color={colors.primary}/></Pressable>
    </View>
    <View style={styles.roles}>
      {ROLES.map((item) => {
        const active = item.key === role;
        const hasProfile = profiles.some((profile) => profile.role === item.key);
        return <Pressable key={item.key} onPress={() => { setRole(item.key); setSearch(""); }} style={[styles.roleChip, active && styles.roleChipActive]}>
          <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{item.label}</Text>
          <Text style={styles.roleCount}>{hasProfile ? "ملف موجود" : "لا يوجد ملف"}</Text>
        </Pressable>;
      })}
    </View>
    <Text style={styles.description}>{ROLES.find((item) => item.key === role)?.description}</Text>
    {loading ? <ActivityIndicator color={colors.primary}/> : currentProfile ? <>
      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>{currentProfile.name}</Text>
        <Text style={styles.description}>الأولوية التالية داخل قائمة النماذج المؤهلة. لا تُستخدم النماذج غير المؤهلة حتى لو أضيفت هنا.</Text>
      </View>
      <Text style={styles.sectionTitle}>النماذج المفضلة الحالية ({selectedIds.length})</Text>
      {selectedIds.length ? selectedIds.map((id, index) => {
        const model = models.find((item) => String(item.id) === id);
        return <View key={id} style={styles.modelRow}>
          <Text style={styles.priority}>{index + 1}</Text>
          <View style={styles.modelCopy}>
            <Text style={styles.modelName}>{model?.name ?? `Model #${id} (غير متاح حاليًا)`}</Text>
            <Text style={styles.modelMeta}>{model ? `${model.provider_name} · ${model.model_identifier}` : "سيظل المعرّف محفوظًا حتى المراجعة"}</Text>
          </View>
          <Pressable disabled={saving || index === 0} onPress={() => move(index, -1)}><Ionicons name="chevron-up" size={18} color={colors.primary}/></Pressable>
          <Pressable disabled={saving || index === selectedIds.length - 1} onPress={() => move(index, 1)}><Ionicons name="chevron-down" size={18} color={colors.primary}/></Pressable>
          <Pressable disabled={saving} onPress={() => setSelectedIds((current) => current.filter((value) => value !== id))}><Ionicons name="close-circle-outline" size={18} color={colors.error}/></Pressable>
        </View>;
      }) : <Text style={styles.description}>لا توجد تفضيلات مضافة. سيستخدم الوكيل ترتيب التوجيه الأساسي.</Text>}
      <Text style={styles.sectionTitle}>إضافة نموذج مؤهل</Text>
      <TextInput value={search} onChangeText={setSearch} placeholder="ابحث بالاسم أو جزء من المعرف..." placeholderTextColor={colors.textMuted} style={styles.input}/>
      {availableModels.length ? availableModels.map((model) => <Pressable key={model.id} onPress={() => add(String(model.id))} disabled={saving || selectedIds.length >= 20} style={styles.availableRow}>
        <View style={styles.modelCopy}>
          <Text style={styles.modelName}>{model.name}</Text>
          <Text style={styles.modelMeta}>{model.provider_name} · {model.model_identifier}</Text>
        </View>
        <Ionicons name="add-circle-outline" size={20} color={colors.primary}/>
      </Pressable>) : <Text style={styles.description}>{query ? "لا توجد نماذج مؤهلة تطابق البحث." : "اكتب جزءًا من اسم النموذج للبحث في النماذج المؤهلة."}</Text>}
      <Pressable disabled={saving || loading} onPress={() => void save()} style={[styles.saveButton, (saving || loading) && styles.disabled]}>
        <Text style={styles.saveText}>{saving ? "جارٍ الحفظ…" : "حفظ تفضيلات الدور"}</Text>
      </Pressable>
    </> : <View style={styles.emptyBox}>
      <Text style={styles.sectionTitle}>لا يوجد ملف إرشادي محفوظ لهذا الدور</Text>
      <Text style={styles.description}>لم يتم إنشاء ملف تلقائي أو اختراع تعليمات. يمكن أن يظل الدور يعمل بسياسة الوكيل المضمنة وسلسلة التوجيه الأساسية حتى إعداد ملفه واعتماده.</Text>
      <TextInput value={newProfileName} onChangeText={setNewProfileName} placeholder="اسم ملف الدور" placeholderTextColor={colors.textMuted} style={styles.input}/>
      <TextInput value={newProfilePrompt} onChangeText={setNewProfilePrompt} placeholder="تعليمات الدور (10 أحرف على الأقل)" placeholderTextColor={colors.textMuted} style={[styles.input, styles.promptInput]} multiline/>
      <Pressable disabled={saving || loading || newProfileName.trim().length < 2 || newProfilePrompt.trim().length < 10} onPress={async () => {
        setSaving(true); setError(null); setNotice(null);
        try {
          await adminService.createAgent({ name: newProfileName, role, systemPrompt: newProfilePrompt, modelFallbackChain: selectedIds });
          setNewProfileName(""); setNewProfilePrompt("");
          await load();
          setNotice("تم إنشاء ملف الدور داخل الوكيل المركزي؛ لم يتم إنشاء وكيل مستقل.");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "تعذر إنشاء ملف الدور.");
        } finally {
          setSaving(false);
        }
      }} style={[styles.saveButton, (saving || loading || newProfileName.trim().length < 2 || newProfilePrompt.trim().length < 10) && styles.disabled]}>
        <Text style={styles.saveText}>{saving ? "جارٍ الإنشاء…" : "إنشاء ملف الدور"}</Text>
      </Pressable>
    </View>}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.success}>{notice}</Text> : null}
  </View>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  card: { borderWidth: 1, borderColor: c.divider, borderRadius: 12, backgroundColor: c.surface, padding: 13, gap: 10 },
  header: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  copy: { flex: 1, alignItems: "flex-end", gap: 3 },
  title: { color: c.textPrimary, fontSize: 14, fontWeight: "900", textAlign: "right" },
  description: { color: c.textMuted, fontSize: 9, lineHeight: 15, textAlign: "right" },
  roles: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  roleChip: { borderWidth: 1, borderColor: c.divider, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: c.background, gap: 3 },
  roleChipActive: { borderColor: c.primary, backgroundColor: c.primary + "12" },
  roleLabel: { color: c.textSecondary, fontSize: 9, fontWeight: "800", textAlign: "right" },
  roleLabelActive: { color: c.primary },
  roleCount: { color: c.textMuted, fontSize: 8, textAlign: "right" },
  profileInfo: { borderWidth: 1, borderColor: c.divider, borderRadius: 9, padding: 10, gap: 4, backgroundColor: c.background },
  profileName: { color: c.textPrimary, fontSize: 11, fontWeight: "900", textAlign: "right" },
  sectionTitle: { color: c.textPrimary, fontSize: 10, fontWeight: "900", textAlign: "right" },
  modelRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.divider, borderRadius: 8, padding: 8 },
  availableRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: c.divider, borderRadius: 8, padding: 9, backgroundColor: c.background },
  modelCopy: { flex: 1, alignItems: "flex-end", gap: 2 },
  modelName: { color: c.textPrimary, fontSize: 9, fontWeight: "800", textAlign: "right" },
  modelMeta: { color: c.textMuted, fontSize: 8, textAlign: "right" },
  priority: { color: c.primary, fontSize: 10, fontWeight: "900" },
  input: { borderWidth: 1, borderColor: c.divider, borderRadius: 8, backgroundColor: c.background, color: c.textPrimary, padding: 9, fontSize: 10, textAlign: "right" },
  promptInput: { minHeight: 110, textAlignVertical: "top" },
  saveButton: { borderRadius: 8, backgroundColor: c.primary, padding: 11, alignItems: "center" },
  saveText: { color: c.onPrimary, fontSize: 10, fontWeight: "900" },
  emptyBox: { borderWidth: 1, borderColor: c.divider, borderRadius: 9, padding: 10, gap: 5 },
  disabled: { opacity: 0.45 },
  error: { color: c.error, fontSize: 10, textAlign: "right" },
  success: { color: c.success, fontSize: 10, textAlign: "right" },
});
