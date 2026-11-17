import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useAuth } from "../auth/auth-provider";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";
import { useToast } from "../../components/ui/Toast";

type SkillStatus = "pending" | "active" | "archived";
type SkillItem = {
  id: string;
  name: string;
  description: string;
  trigger_examples: unknown[];
  steps: unknown[];
  source_kind: "conversation" | "agent_task";
  status: SkillStatus;
  confidence: number;
  created_at: string;
};

export default function SkillRegistryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const { show } = useToast();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [items, setItems] = useState<SkillItem[]>([]);
  const [filter, setFilter] = useState<SkillStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadSkills = useCallback(async (refresh = false, isActive: () => boolean = () => true) => {
    if (!user?.id) {
      if (isActive()) { setItems([]); setLoading(false); }
      return;
    }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("user_learned_skills")
        .select("id,name,description,trigger_examples,steps,source_kind,status,confidence,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      if (isActive()) setItems(Array.isArray(data) ? data as SkillItem[] : []);
    } catch {
      if (isActive()) setError(isArabic ? "تعذر تحميل المهارات. تحقق من الاتصال وحاول مرة أخرى." : "Could not load skills. Check your connection and try again.");
    } finally {
      if (isActive()) { setLoading(false); setRefreshing(false); }
    }
  }, [user?.id, isArabic]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadSkills(false, () => active);
    return () => { active = false; };
  }, [loadSkills]));

  const updateStatus = async (item: SkillItem, status: SkillStatus) => {
    if (!user?.id || busyId) return;
    setBusyId(item.id);
    try {
      const { data, error: updateError } = await supabase.from("user_learned_skills")
        .update({ status }).eq("id", item.id).eq("user_id", user.id).select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("skill_update_not_confirmed");
      setItems((current) => current.map((skill) => skill.id === item.id ? { ...skill, status } : skill));
      show(status === "active"
        ? (isArabic ? "تم تفعيل المهارة، وسيستخدمها SULY عند صلتها بطلبك." : "Skill activated. SULY may use it when relevant.")
        : (isArabic ? "تم تحديث حالة المهارة." : "Skill status updated."), "success");
    } catch {
      show(isArabic ? "تعذر تحديث المهارة. حاول مرة أخرى." : "Could not update the skill. Try again.", "error");
    } finally { setBusyId(null); }
  };

  const deleteSkill = async (item: SkillItem) => {
    if (!user?.id || busyId) return;
    setBusyId(item.id);
    try {
      const { error: deleteError } = await supabase.from("user_learned_skills")
        .delete().eq("id", item.id).eq("user_id", user.id);
      if (deleteError) throw deleteError;
      setItems((current) => current.filter((skill) => skill.id !== item.id));
      show(isArabic ? "تم حذف المهارة." : "Skill deleted.", "success");
    } catch {
      show(isArabic ? "تعذر حذف المهارة." : "Could not delete the skill.", "error");
    } finally { setBusyId(null); }
  };

  const visibleItems = items.filter((item) => item.status === filter);
  const statusLabel = (status: SkillStatus) => status === "pending"
    ? (isArabic ? "بانتظار مراجعتك" : "Needs your review")
    : status === "active" ? (isArabic ? "مفعّلة" : "Active") : (isArabic ? "مؤرشفة" : "Archived");
  const stepLabel = (step: unknown) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) return "";
    const value = step as Record<string, unknown>;
    return [value.tool, value.label, value.summary, value.instruction].filter((part) => typeof part === "string" && part.trim()).join(" — ").slice(0, 300);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={isArabic ? "رجوع" : "Back"}>
          <Ionicons name={isArabic ? "arrow-forward" : "arrow-back"} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isArabic ? "مهارات SULY" : "SULY skills"}</Text>
        <TouchableOpacity onPress={() => void loadSkills(true)} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={isArabic ? "تحديث" : "Refresh"} disabled={refreshing || loading}>
          {refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh" size={20} color={colors.textPrimary} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{isArabic ? "كيف يتعلم SULY المهارات؟" : "How SULY learns skills"}</Text>
          <Text style={styles.noticeBody}>{isArabic
            ? "يتعلم من الطرق التي تعلّمه إياها صراحة في المحادثة، ويقترح مهارات من مهام الوكيل الناجحة. المهارات الجديدة تظل معلّقة حتى توافق عليها."
            : "SULY can learn methods you explicitly teach in chat and propose skills from successful Agent tasks. New skills stay pending until you approve them."}</Text>
          <Text style={styles.noticeFoot}>{isArabic
            ? "المهارة النشطة تساعد في تنظيم الخطوات فقط؛ لا تمنح صلاحيات أو وصولًا للتطبيقات ولا تتجاوز موافقتك على الإجراءات."
            : "An active skill only guides the workflow. It never grants permissions, app access, or bypasses your approval for actions."}</Text>
        </View>

        <View style={styles.filters}>
          {(["pending", "active", "archived"] as const).map((status) => (
            <TouchableOpacity key={status} onPress={() => setFilter(status)} style={[styles.filterButton, filter === status && styles.filterSelected]} accessibilityRole="button" accessibilityState={{ selected: filter === status }}>
              <Text style={[styles.filterText, filter === status && styles.filterSelectedText]}>{statusLabel(status)}</Text>
              <Text style={[styles.filterCount, filter === status && styles.filterSelectedText]}>{items.filter((item) => item.status === status).length}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>{isArabic ? "جارٍ تحميل المهارات…" : "Loading skills…"}</Text></View> : null}
        {!loading && error ? <View style={styles.state}><Text style={styles.error}>{error}</Text><TouchableOpacity onPress={() => void loadSkills()} style={styles.retryButton}><Text style={styles.retryText}>{isArabic ? "إعادة المحاولة" : "Try again"}</Text></TouchableOpacity></View> : null}
        {!loading && !error && visibleItems.length === 0 ? <View style={styles.state}><Ionicons name="sparkles-outline" size={28} color={colors.textMuted} /><Text style={styles.stateText}>{filter === "pending" ? (isArabic ? "لا توجد مهارات جديدة للمراجعة حتى الآن." : "No new skills to review yet.") : filter === "active" ? (isArabic ? "لا توجد مهارات مفعّلة بعد." : "No active skills yet.") : (isArabic ? "لا توجد مهارات مؤرشفة." : "No archived skills.")}</Text></View> : null}

        {visibleItems.map((item) => (
          <View key={item.id} style={styles.skillCard}>
            <View style={styles.skillHeading}>
              <Text style={styles.skillName}>{item.name}</Text>
              <Text style={[styles.status, item.status === "active" && styles.statusActive]}>{statusLabel(item.status)}</Text>
            </View>
            <Text style={styles.description}>{item.description}</Text>
            <Text style={styles.source}>{item.source_kind === "agent_task" ? (isArabic ? "مستخلصة من مهمة وكيل ناجحة" : "Learned from a successful Agent task") : (isArabic ? "من تعليماتك في المحادثة" : "From your chat instruction")}</Text>
            {Array.isArray(item.steps) && item.steps.length ? (
              <View style={styles.steps}>
                <Text style={styles.stepsTitle}>{isArabic ? "الخطوات المقترحة" : "Suggested steps"}</Text>
                {item.steps.slice(0, 6).map((step, index) => <Text key={index} style={styles.stepText}>{index + 1}. {stepLabel(step) || (isArabic ? "خطوة محفوظة" : "Saved step")}</Text>)}
              </View>
            ) : null}
            <View style={styles.actions}>
              {item.status !== "active" ? <TouchableOpacity disabled={busyId === item.id} onPress={() => void updateStatus(item, "active")} style={styles.primaryAction}>
                {busyId === item.id ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={styles.primaryActionText}>{isArabic ? "تفعيل المهارة" : "Activate skill"}</Text>}
              </TouchableOpacity> : <TouchableOpacity disabled={busyId === item.id} onPress={() => void updateStatus(item, "archived")} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>{isArabic ? "أرشفة" : "Archive"}</Text></TouchableOpacity>}
              <TouchableOpacity disabled={busyId === item.id} onPress={() => void deleteSkill(item)} style={styles.deleteAction}><Text style={styles.deleteText}>{isArabic ? "حذف" : "Delete"}</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemePalette, isArabic: boolean) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 12, maxWidth: 900, width: "100%", alignSelf: "center" },
    header: { minHeight: 54, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
    headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "800" },
    notice: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 14, gap: 8 },
    noticeTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
    noticeBody: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, textAlign: isArabic ? "right" : "left" },
    noticeFoot: { color: colors.textMuted, fontSize: 11, lineHeight: 18, textAlign: isArabic ? "right" : "left" },
    filters: { flexDirection: "row", gap: 6 },
    filterButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", gap: 4 },
    filterSelected: { backgroundColor: colors.primary },
    filterText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", textAlign: "center" },
    filterSelectedText: { color: colors.onPrimary },
    filterCount: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
    skillCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 14, gap: 10 },
    skillHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
    skillName: { color: colors.textPrimary, fontSize: 14, fontWeight: "800", flex: 1, textAlign: isArabic ? "right" : "left" },
    status: { color: colors.warning, fontSize: 10, fontWeight: "700" },
    statusActive: { color: colors.success },
    description: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, textAlign: isArabic ? "right" : "left" },
    source: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left" },
    steps: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 9, gap: 6 },
    stepsTitle: { color: colors.textPrimary, fontSize: 11, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
    stepText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, textAlign: isArabic ? "right" : "left" },
    actions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 2 },
    primaryAction: { minWidth: 112, minHeight: 36, paddingHorizontal: 12, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    primaryActionText: { color: colors.onPrimary, fontSize: 11, fontWeight: "800" },
    secondaryAction: { minHeight: 36, paddingHorizontal: 12, borderRadius: 9, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    secondaryActionText: { color: colors.textPrimary, fontSize: 11, fontWeight: "700" },
    deleteAction: { minHeight: 36, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
    deleteText: { color: colors.error, fontSize: 11, fontWeight: "700" },
    state: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 10 },
    stateText: { color: colors.textSecondary, fontSize: 12, textAlign: "center" },
    error: { color: colors.error, fontSize: 12, textAlign: "center" },
    retryButton: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9, backgroundColor: colors.surface },
    retryText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  });
}
