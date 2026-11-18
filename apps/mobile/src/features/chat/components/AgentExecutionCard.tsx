import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { useSulyTheme } from "../../../theme/ThemeProvider";
import type { ThemePalette } from "../../../theme/colors";
import { useAppLocale } from "../../../theme/LocaleProvider";
import type { ChatAgentProgress, ChatAgentStep } from "../../brain/task-service";

type Props = {
  progress: ChatAgentProgress;
  canCancel?: boolean;
  cancelPending?: boolean;
  onCancel?(): void;
};

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

function statusLabel(status: string, isArabic: boolean): string {
  const labels: Record<string, [string, string]> = {
    planning: ["يجهّز خطة التنفيذ", "Preparing the execution plan"],
    executing: ["ينفّذ المهمة", "Executing task"],
    reviewing: ["يراجع النتيجة", "Reviewing the result"],
    waiting_approval: ["ينتظر موافقتك", "Waiting for your approval"],
    retrying: ["يعيد محاولة خطوة", "Retrying a step"],
    completed: ["اكتملت المهمة", "Task completed"],
    failed: ["تعذّر إكمال المهمة", "Task failed"],
    cancelled: ["أُوقفت المهمة", "Task stopped"],
  };
  const pair = labels[status] ?? ["حالة المهمة", "Task status"];
  return isArabic ? pair[0] : pair[1];
}

function stepStatusLabel(status: string, isArabic: boolean): string {
  const labels: Record<string, [string, string]> = {
    pending: ["في الانتظار", "Pending"],
    running: ["قيد التنفيذ", "Running"],
    reviewing: ["مراجعة", "Reviewing"],
    waiting_approval: ["تحتاج موافقة", "Needs approval"],
    retrying: ["إعادة المحاولة", "Retrying"],
    completed: ["مكتملة", "Completed"],
    failed: ["تعذّر تنفيذها", "Failed"],
  };
  const pair = labels[status] ?? ["—", "—"];
  return isArabic ? pair[0] : pair[1];
}

function toolLabel(tool: string, isArabic: boolean): string {
  const labels: Record<string, [string, string]> = {
    "connected_app.status": ["فحص اتصال التطبيق", "Checking app connection"],
    "connected_app.read": ["قراءة من تطبيق متصل", "Reading a connected app"],
    "connected_app.read_multiple": ["قراءة من تطبيقات متصلة", "Reading connected apps"],
    "connected_app.write": ["إجراء على تطبيق متصل", "Action on a connected app"],
    "web.search": ["البحث في الويب", "Web search"],
  };
  const pair = labels[tool] ?? ["أداة مسجلة", "Registered tool"];
  return isArabic ? pair[0] : pair[1];
}

function StepIcon({ step, colors }: { step: ChatAgentStep; colors: ThemePalette }) {
  const icon = step.status === "completed" ? "checkmark-circle-outline"
    : step.status === "failed" ? "alert-circle-outline"
    : step.status === "running" ? "radio-button-on-outline"
    : step.status === "waiting_approval" ? "hand-left-outline"
    : "ellipse-outline";
  return <Ionicons name={icon} size={16} color={step.status === "completed" ? colors.textPrimary : colors.textMuted} />;
}

export function AgentExecutionCard({ progress, canCancel = false, cancelPending = false, onCancel }: Props) {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const [expanded, setExpanded] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const completedSteps = progress.steps.filter((step) => step.status === "completed").length;
  const totalSteps = Math.max(progress.steps.length, progress.plan.length);
  const percent = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const activeStep = progress.steps.find((step) => step.key === progress.currentStepKey)
    ?? progress.steps.find((step) => step.status === "running" || step.status === "reviewing" || step.status === "waiting_approval" || step.status === "retrying");
  const isTerminal = TERMINAL.has(progress.status);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={isArabic ? "تفاصيل تنفيذ المهمة" : "Task execution details"}
      >
        <View style={styles.iconWrap}><Ionicons name="git-branch-outline" size={18} color={colors.textPrimary} /></View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{isArabic ? "تنفيذ SULY للمهمة" : "SULY task execution"}</Text>
          <Text style={styles.subtitle}>{statusLabel(progress.status, isArabic)}{totalSteps ? ` · ${completedSteps}/${totalSteps}` : ""}</Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </Pressable>

      {activeStep && !isTerminal ? <Text style={styles.currentStep} numberOfLines={2}>{activeStep.description}</Text> : null}
      {totalSteps ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: colors.primary }]} />
        </View>
      ) : null}

      {canCancel && !isTerminal ? (
        <Pressable onPress={onCancel} disabled={cancelPending} style={styles.stopButton} accessibilityRole="button" accessibilityLabel={isArabic ? "إيقاف تنفيذ المهمة" : "Stop task execution"}>
          {cancelPending ? <ActivityIndicator size="small" color={colors.textPrimary} /> : <Ionicons name="stop" size={14} color={colors.textPrimary} />}
          <Text style={styles.stopText}>{cancelPending ? (isArabic ? "جارٍ انتظار تأكيد الإيقاف…" : "Waiting for stop confirmation…") : (isArabic ? "إيقاف المهمة" : "Stop task")}</Text>
        </Pressable>
      ) : null}

      {expanded ? (
        <View style={styles.details}>
          {progress.plan.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{isArabic ? "ملخص الخطة" : "Plan summary"}</Text>
              {progress.plan.map((step) => (
                <View key={step.key} style={styles.planRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.planText}>{step.description}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {progress.steps.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{isArabic ? "خطوات التنفيذ" : "Execution steps"}</Text>
              {progress.steps.map((step) => (
                <View key={step.key} style={styles.stepRow}>
                  <StepIcon step={step} colors={colors} />
                  <View style={styles.stepCopy}>
                    <Text style={styles.stepDescription}>{step.description}</Text>
                    <Text style={styles.stepStatus}>{stepStatusLabel(step.status, isArabic)}{step.attemptNo > 1 ? ` · ${isArabic ? "محاولة" : "Attempt"} ${step.attemptNo}` : ""}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {progress.tools.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{isArabic ? "نشاط الأدوات" : "Tool activity"}</Text>
              {progress.tools.map((tool, index) => (
                <View key={`${tool.tool}-${tool.startedAt ?? index}-${index}`} style={styles.toolRow}>
                  <Ionicons name="construct-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.toolText}>{toolLabel(tool.tool, isArabic)}</Text>
                  <Text style={styles.stepStatus}>{stepStatusLabel(tool.status, isArabic)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {progress.status === "completed" ? <Text style={styles.terminalNote}>{isArabic ? "حُفظت النتيجة في الرد التالي داخل المحادثة." : "The result is saved in the next message in this conversation."}</Text> : null}
          {progress.status === "failed" ? <Text style={styles.terminalNote}>{isArabic ? "راجع رسالة SULY التالية لمعرفة ما أمكن إنجازه." : "See the following SULY message for what could be completed."}</Text> : null}
          {progress.status === "cancelled" ? <Text style={styles.terminalNote}>{isArabic ? "أكد الخادم إيقاف المهمة." : "The server confirmed that the task was stopped."}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  card: { width: "94%", alignSelf: "flex-end", marginHorizontal: 16, marginTop: 4, marginBottom: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 42 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, fontSize: 11 },
  currentStep: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 8 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceElevated, overflow: "hidden", marginTop: 10 },
  progressFill: { height: 4, borderRadius: 2 },
  stopButton: { minHeight: 36, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, marginTop: 10, borderRadius: 9, borderWidth: 1, borderColor: colors.divider },
  stopText: { color: colors.textPrimary, fontSize: 11, fontWeight: "700" },
  details: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: 12, paddingTop: 12, gap: 14 },
  section: { gap: 8 },
  sectionTitle: { color: colors.textPrimary, fontSize: 11, fontWeight: "800" },
  planRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textMuted, marginTop: 6 },
  planText: { flex: 1, color: colors.textSecondary, fontSize: 11, lineHeight: 17 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  stepCopy: { flex: 1, minWidth: 0, gap: 2 },
  stepDescription: { color: colors.textSecondary, fontSize: 11, lineHeight: 17 },
  stepStatus: { color: colors.textMuted, fontSize: 10 },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolText: { flex: 1, color: colors.textSecondary, fontSize: 11 },
  terminalNote: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
});
