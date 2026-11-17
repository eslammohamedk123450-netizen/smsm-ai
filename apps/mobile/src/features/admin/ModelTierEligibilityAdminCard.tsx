import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { adminService } from "./admin-service";

type Tier = "free" | "lite" | "pro" | "max" | "ultra_team";
type ModelRow = {
  id: number;
  name: string;
  model_identifier: string;
  provider_name: string;
  enabled: boolean;
  provider_enabled?: boolean;
  routing_group: string;
  allowed_tiers: string[] | null;
  health?: { auto_restricted?: boolean } | null;
};
const TIERS: Array<{ key: Tier; label: string; rank: number }> = [
  { key: "free", label: "Free", rank: 0 },
  { key: "lite", label: "Lite", rank: 1 },
  { key: "pro", label: "Pro", rank: 2 },
  { key: "max", label: "Max", rank: 3 },
  { key: "ultra_team", label: "Ultra Team", rank: 4 },
];

function minimumTier(allowed: string[] | null): Tier | null {
  const eligible = TIERS.filter((tier) => (allowed ?? []).includes(tier.key));
  return eligible.sort((a, b) => a.rank - b.rank)[0]?.key ?? null;
}

function statusLabel(model: ModelRow): string {
  if (model.health?.auto_restricted) return "مقيّد";
  if (!model.enabled || model.provider_enabled === false || model.routing_group === "disabled") return "معطّل";
  return "مفعّل";
}

export function ModelTierEligibilityAdminCard() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const overview = await adminService.getModelsOverview();
      setModels((overview.models ?? []) as ModelRow[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل تكلفة النماذج مستقلة عن الباقات.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const query = search.trim().toLocaleLowerCase();
  const visibleModels = models.filter((model) =>
    !query || `${model.name} ${model.model_identifier} ${model.provider_name}`.toLocaleLowerCase().includes(query)
  ).slice(0, 100);

  const assignTier = async (model: ModelRow, tier: Tier) => {
    if (tier === "free" && model.routing_group !== "free_race") {
      setError("لا يمكن منح أهلية Free لنموذج خارج مجموعة Free. انقله أولًا إلى مجموعة Free بعد التأكد من تكلفته وأهليته.");
      return;
    }
    setSavingId(model.id); setError(null); setNotice(null);
    try {
      await adminService.updateModel(model.id, { allowed_tiers: [tier] });
      setModels((current) => current.map((item) => item.id === model.id ? { ...item, allowed_tiers: [tier] } : item));
      setNotice(`تم تحديث أهلية ${model.name} لتبدأ من ${TIERS.find((item) => item.key === tier)?.label}، وتَرِثها الباقات الأعلى.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث أهلية النموذج.");
    } finally {
      setSavingId(null);
    }
  };

  return <View style={styles.card}>
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text style={styles.title}>أهلية النماذج حسب الباقة</Text>
        <Text style={styles.description}>الباقات لا تحدد النماذج المسموح بها. تُحسب تكلفة الاستخدام حسب النموذج الفعلي، بينما تحدد الباقة الرصيد والمميزات والحدود.</Text>
      </View>
      <Pressable onPress={() => void load()}><Ionicons name="refresh-outline" size={19} color={colors.primary}/></Pressable>
    </View>
    <View style={styles.note}>
      <Text style={styles.noteText}>لا تستخدم هذه الشاشة لربط النماذج بالباقات. إدارة تكلفة كل نموذج وحالته التشغيلية تتم بشكل مستقل عن الاشتراك.</Text>
    </View>
    <TextInput value={search} onChangeText={setSearch} placeholder="ابحث باسم النموذج أو جزء من المعرف..." placeholderTextColor={colors.textMuted} style={styles.input}/>
    {loading ? <ActivityIndicator color={colors.primary}/> : null}
    {visibleModels.map((model) => {
      const current = minimumTier(model.allowed_tiers);
      const state = statusLabel(model);
      return <View key={model.id} style={styles.modelCard}>
        <View style={styles.modelHeader}>
          <View style={styles.copy}>
            <Text style={styles.modelName}>{model.name}</Text>
            <Text style={styles.modelMeta}>{model.provider_name} · {model.model_identifier}</Text>
            <Text style={styles.modelMeta}>التشغيل: {state} · المجموعة: {model.routing_group}</Text>
          </View>
          <Text style={styles.currentTier}>{current ? TIERS.find((item) => item.key === current)?.label : "غير محدد"}</Text>
        </View>
        <View style={styles.tiers}>
          {TIERS.map((tier) => {
            const active = current === tier.key;
            const blocked = tier.key === "free" && model.routing_group !== "free_race";
            return <Pressable key={tier.key} disabled={savingId === model.id || blocked} onPress={() => void assignTier(model, tier.key)} style={[styles.tierChip, active && styles.tierChipActive, blocked && styles.tierChipBlocked]}>
              <Text style={[styles.tierText, active && styles.tierTextActive, blocked && styles.tierTextBlocked]}>{tier.label}</Text>
            </Pressable>;
          })}
        </View>
      </View>;
    })}
    {!loading && visibleModels.length === 0 ? <Text style={styles.description}>لا توجد نماذج تطابق البحث.</Text> : null}
    {models.length > 100 && !query ? <Text style={styles.description}>يتم عرض أول 100 نموذج. استخدم البحث للوصول إلى بقية المكتبة.</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.success}>{notice}</Text> : null}
  </View>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  card: { borderWidth: 1, borderColor: c.divider, borderRadius: 12, backgroundColor: c.surface, padding: 13, gap: 10 },
  header: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  copy: { flex: 1, alignItems: "flex-end", gap: 3 },
  title: { color: c.textPrimary, fontSize: 13, fontWeight: "900", textAlign: "right" },
  description: { color: c.textMuted, fontSize: 9, lineHeight: 15, textAlign: "right" },
  note: { borderWidth: 1, borderColor: c.divider, borderRadius: 9, padding: 9, backgroundColor: c.background },
  noteText: { color: c.textMuted, fontSize: 9, lineHeight: 15, textAlign: "right" },
  input: { borderWidth: 1, borderColor: c.divider, borderRadius: 8, backgroundColor: c.background, color: c.textPrimary, padding: 9, fontSize: 10, textAlign: "right" },
  modelCard: { borderWidth: 1, borderColor: c.divider, borderRadius: 9, padding: 9, gap: 8 },
  modelHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 },
  modelName: { color: c.textPrimary, fontSize: 10, fontWeight: "900", textAlign: "right" },
  modelMeta: { color: c.textMuted, fontSize: 8, textAlign: "right" },
  currentTier: { color: c.primary, fontSize: 9, fontWeight: "900" },
  tiers: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 5 },
  tierChip: { borderWidth: 1, borderColor: c.divider, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: c.background },
  tierChipActive: { borderColor: c.primary, backgroundColor: c.primary + "14" },
  tierChipBlocked: { opacity: 0.3 },
  tierText: { color: c.textMuted, fontSize: 8, fontWeight: "800" },
  tierTextActive: { color: c.primary },
  tierTextBlocked: { color: c.textMuted },
  error: { color: c.error, fontSize: 9, textAlign: "right" },
  success: { color: c.success, fontSize: 9, textAlign: "right" },
});
