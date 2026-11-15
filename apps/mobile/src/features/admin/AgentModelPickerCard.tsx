import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { colors } from "../../theme/colors";

type ModelChoice = {
  id: number;
  name: string;
  model_identifier: string;
  provider_name: string;
  enabled: boolean;
  provider_enabled?: boolean;
  routing_group: string;
  task_roles?: string[] | null;
  capabilities_json?: string | Record<string, unknown> | null;
  health: { auto_restricted?: boolean } | null;
};

type Props = {
  role: "planner" | "summarizer";
  models: ModelChoice[];
  selectedModelId: number | null;
  busy: boolean;
  onSelect(modelId: number | null): void;
};

function supportsRole(model: ModelChoice, role: "planner" | "summarizer"): boolean {
  const roles = model.task_roles?.length ? model.task_roles : ["general"];
  return roles.includes("general") || roles.includes(role);
}

function supportsChat(value: ModelChoice["capabilities_json"], modelIdentifier: string): boolean {
  let capabilities: Record<string, unknown> = {};
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) capabilities = parsed as Record<string, unknown>;
    } catch { return false; }
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    capabilities = value;
  }
  return capabilities.chat !== false
    && !/(embed|embedding|whisper|tts|speech|audio|image|imagen|dall-e|flux|stable-diffusion|kling|seedance|seedream|ideogram|nano-banana|minimax|lyria|transcrib|robotics|deep-research|computer-use|guard|moderation|rerank)/i.test(modelIdentifier);
}

export function AgentModelPickerCard({ role, models, selectedModelId, busy, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const isPlanner = role === "planner";
  const eligibleModels = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return models.filter((model) => model.provider_enabled === true && model.enabled
      && model.routing_group !== "disabled" && !model.health?.auto_restricted
      && supportsRole(model, role)
      && supportsChat(model.capabilities_json, model.model_identifier)
      && `${model.name} ${model.model_identifier} ${model.provider_name}`.toLocaleLowerCase().includes(query));
  }, [models, search]);
  const selectedModel = models.find((model) => model.id === selectedModelId);
  const selectedUnavailable = Boolean(selectedModel && !eligibleModels.some((model) => model.id === selectedModel.id));
  const label = isPlanner ? "Planner · مخطط خطوات الوكيل" : "Summarizer · ملخص نتائج الأدوات";
  const help = isPlanner
    ? "يُجرّب هذا النموذج أولًا عند اتخاذ قرارات Agent، ضمن أهلية الخطة والقدرات ومسار النماذج. إذا تعذّر استخدامه يعود الراوتر إلى ترتيب النماذج المعتاد."
    : "يعمل بعد نجاح قراءة Gmail أو Drive أو GitHub أو البحث لمراجعة الرد. عند اختيار «تلقائي» يُعاد استخدام نموذج Planner؛ أما اختيار نموذج هنا فيفصل دور Summarizer. لا يُستدعى لطلبات الموافقة أو الكتابة الخارجية.";

  return <View style={styles.card}>
    <Text style={styles.title}>{label}</Text>
    <Text style={styles.help}>{help}</Text>
    {selectedUnavailable ? <Text style={styles.notice}>النموذج المحفوظ غير جاهز حاليًا؛ سيستخدم النظام التوجيه العام حتى يصبح مؤهلًا.</Text> : null}
    <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="ابحث عن نموذج نصي" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
    <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
      <View style={styles.options}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedModelId === null }} disabled={busy} onPress={() => onSelect(null)} style={[styles.option, selectedModelId === null && styles.optionSelected]}>
          <Text style={[styles.optionText, selectedModelId === null && styles.optionTextSelected]}>تلقائي · مسار النماذج العام</Text>
        </Pressable>
        {eligibleModels.map((model) => <Pressable key={model.id} accessibilityRole="button" accessibilityState={{ selected: selectedModelId === model.id }} disabled={busy} onPress={() => onSelect(model.id)} style={[styles.option, selectedModelId === model.id && styles.optionSelected]}>
          <Text style={[styles.optionText, selectedModelId === model.id && styles.optionTextSelected]}>{model.name} · {model.provider_name}</Text>
        </Pressable>)}
      </View>
      {eligibleModels.length === 0 ? <Text style={styles.help}>لا توجد نماذج نصية نشطة تطابق البحث.</Text> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 12, gap: 10 },
  title: { color: colors.textPrimary, fontWeight: "900", fontSize: 14, textAlign: "right" },
  help: { color: colors.textMuted, fontSize: 10, textAlign: "right", lineHeight: 16 },
  notice: { color: colors.warning ?? colors.primary, fontSize: 10, textAlign: "right" },
  input: { minHeight: 38, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, color: colors.textPrimary, paddingHorizontal: 10, textAlign: "right", fontSize: 11 },
  list: { maxHeight: 160 },
  options: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  option: { borderWidth: 1, borderColor: colors.divider, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 11 },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
  optionText: { color: colors.textSecondary, fontSize: 10 },
  optionTextSelected: { color: colors.primary, fontWeight: "800" },
});
