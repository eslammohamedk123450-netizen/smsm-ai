import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useToast } from "../../components/ui/Toast";
import { colors } from "../../theme/colors";
import { runBrainTask, type BrainTaskResult } from "./brain-service";

const TASK_TEMPLATES = [
  { title: "تحليل ملف أو بيانات", prompt: "حلّل البيانات التالية واستخرج أهم المؤشرات والمشكلات والتوصيات العملية: " },
  { title: "خطة تنفيذ مشروع", prompt: "أنشئ خطة تنفيذ عملية للمشروع التالي مع المراحل والاعتماديات ومعايير النجاح: " },
  { title: "بحث ومقارنة", prompt: "ابحث وحلّل الموضوع التالي، ثم قدّم مقارنة منظمة وخلاصة قابلة للتنفيذ: " },
];

export function BrainTaskScreen() {
  const router = useRouter();
  const { show } = useToast();
  const [objective, setObjective] = useState("");
  const [result, setResult] = useState<BrainTaskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = objective.trim();
    if (!value) {
      setError("اكتب هدف المهمة أولًا.");
      return;
    }
    if (value.length > 50000) {
      setError("المهمة طويلة جدًا. اختصرها إلى 50000 حرف أو أقل.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const next = await runBrainTask(value);
      setResult(next);
      show("اكتمل تنفيذ المهمة.", "success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تنفيذ المهمة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>‹ رجوع</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BRAIN ORCHESTRATION</Text>
          <Text style={styles.title}>تنفيذ مهمة ذكية</Text>
          <Text style={styles.muted}>يُصنّف الطلب أولًا، ثم يستخدم التخطيط والتنفيذ متعدد الخطوات عند الحاجة فقط.</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>ابدأ من قالب أو اكتب هدفك</Text>
        <View style={styles.templateRow}>
          {TASK_TEMPLATES.map((template) => (
            <Pressable key={template.title} onPress={() => setObjective(template.prompt)} style={styles.template} accessibilityRole="button">
              <Text style={styles.templateText}>{template.title}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={objective}
          onChangeText={setObjective}
          placeholder="مثال: حلّل خطة إطلاق المنتج وحدد المخاطر والاعتماديات…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={50000}
          textAlignVertical="top"
          style={styles.input}
          accessibilityLabel="هدف المهمة"
        />
        <View style={styles.actions}>
          <Pressable onPress={() => { setObjective(""); setResult(null); setError(null); }} style={styles.secondary} disabled={busy}>
            <Text style={styles.secondaryText}>مسح</Text>
          </Pressable>
          <Pressable onPress={() => void submit()} style={[styles.primary, busy && styles.disabled]} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#071018" /> : <Text style={styles.primaryText}>تشغيل المهمة</Text>}
          </Pressable>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>

      {result ? (
        <View style={styles.panel}>
          <View style={styles.resultHeader}>
            <Text style={styles.sectionTitle}>النتيجة</Text>
            <Text style={styles.completed}>مكتملة</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>التعقيد: {result.complexity === "complex" ? "معقدة" : "مباشرة"}</Text>
            <Text style={styles.meta}>الخطوات: {result.steps_completed} / {result.estimated_steps}</Text>
          </View>
          <Text style={styles.response}>{result.response}</Text>
          <Text style={styles.taskId}>معرف التتبع: {result.task_id}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 14, gap: 12, maxWidth: 900, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  headerCopy: { flex: 1, alignItems: "flex-end" },
  backButton: { borderWidth: 1, borderColor: colors.divider, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  backText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900" },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: "900", textAlign: "right", marginTop: 2 },
  muted: { color: colors.textMuted, fontSize: 10, textAlign: "right", lineHeight: 18 },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 12, gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontWeight: "900", fontSize: 15, textAlign: "right" },
  templateRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  template: { borderWidth: 1, borderColor: colors.divider, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  templateText: { color: colors.textSecondary, fontSize: 10 },
  input: { minHeight: 150, borderWidth: 1, borderColor: colors.divider, borderRadius: 9, color: colors.textPrimary, padding: 11, textAlign: "right", fontSize: 12, lineHeight: 20 },
  actions: { flexDirection: "row-reverse", gap: 8, justifyContent: "flex-start" },
  primary: { minWidth: 130, alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  primaryText: { color: "#071018", fontWeight: "900", fontSize: 11 },
  secondary: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14 },
  secondaryText: { color: colors.textPrimary, fontSize: 11, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  error: { color: colors.error, fontSize: 10, textAlign: "right" },
  resultHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  completed: { color: colors.success, fontSize: 10, fontWeight: "800" },
  metaRow: { flexDirection: "row-reverse", gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider, paddingVertical: 8 },
  meta: { color: colors.textMuted, fontSize: 10 },
  response: { color: colors.textPrimary, fontSize: 13, lineHeight: 23, textAlign: "right" },
  taskId: { color: colors.textMuted, fontSize: 9, textAlign: "right" },
});
