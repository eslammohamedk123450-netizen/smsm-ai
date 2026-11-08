import { useEffect, useMemo, useState } from "react";
import { Link } from "expo-router";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { adminService, type PricingPlan } from "./admin-service";
import { providerPresets, findPreset, type ProviderPreset } from "./provider-presets";
import { confirmAdminAction } from "./admin-confirm";
import { colors } from "../../theme/colors";

type ProviderRow = { id: number; name: string; provider_type: string; base_url: string | null; enabled: boolean; last_test_status: string | null };
type ModelRow = {
  id: number;
  provider_id: number;
  name: string;
  provider_name: string;
  provider_enabled?: boolean;
  model_identifier: string;
  enabled: boolean;
  priority: number;
  context_window: number | null;
  routing_group: string;
  allowed_tiers: string[] | null;
  response_timeout_ms: number;
  restriction_failure_threshold: number;
  restriction_window_minutes: number;
  health: { auto_restricted?: boolean; consecutive_failures?: number; restriction_reason?: string | null; last_status?: string | null } | null;
  probe: { consecutive_scheduled_failures?: number; consecutive_scheduled_successes?: number; last_scheduled_status?: string | null; last_scheduled_at?: string | null; last_error_code?: string | null } | null;
};
type AttemptRow = { attempt_status: string; duration_ms: number | null; error_code: string | null; error_reason: string | null; created_at: string };
type ProbeLogRow = { run_type: "manual" | "scheduled"; status: "success" | "error" | "skipped"; duration_ms: number; error_code: string | null; checked_at: string; model_name: string; provider_name: string };
type UserRow = { id: string; email: string; full_name: string | null; subscription_tier: string | null; is_banned: boolean; balance: number; reserved_balance: number };
type TransactionRow = { id?: string; user_id?: string; event_type: string; amount: number; balance_delta?: number; balance_after: number; actual_cost?: number | null; input_tokens?: number; output_tokens?: number; model_id?: number | null; source?: string; reason?: string | null; created_at: string };

function PageHeader({ title }: { title: string }) {
  return <View style={styles.header}><Link href="/admin" asChild><Pressable><Text style={styles.back}>‹ لوحة المشرف</Text></Pressable></Link><Text style={styles.pageTitle}>{title}</Text></View>;
}
function ErrorText({ children }: { children: string | null }) { return children ? <Text accessibilityRole="alert" style={styles.error}>{children}</Text> : null; }
function probeErrorLabel(code: string | null) {
  if (!code) return "تعذر الحصول على رد صالح.";
  if (code === "provider_http_401" || code === "provider_http_403" || code === "credential_unavailable") return "تحقق من المفتاح أو صلاحياته.";
  if (code === "provider_http_429") return "تجاوز المزود حد الطلبات أو الحصة.";
  if (code === "model_timeout") return "انتهت مهلة استجابة النموذج.";
  if (code === "empty_response") return "وصلت استجابة فارغة.";
  if (code === "provider_url_invalid") return "رابط المزود غير صالح.";
  if (code === "provider_disabled") return "المزود متوقف؛ فعّله قبل الاختبار.";
  return `فشل الاتصال (${code}).`;
}
function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }

export function ProvidersAdminScreen() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [providerModels, setProviderModels] = useState<ModelRow[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hideModelsOnDisable, setHideModelsOnDisable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [testingModelId, setTestingModelId] = useState<number | null>(null);
  const [expandedProviderId, setExpandedProviderId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedPreset = findPreset(selectedType);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [providerRows, modelOverview] = await Promise.all([adminService.getProviders(), adminService.getModelsOverview()]);
      setProviders(providerRows as ProviderRow[]);
      setProviderModels(modelOverview.models as ModelRow[]);
    }
    catch { setError("تعذر تحميل مزودي الخدمة. تحقق من الصلاحيات وسياسات RLS."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const syncProvider = async (provider: ProviderRow) => {
    setBusyId(provider.id); setError(null); setNotice(null);
    try {
      const result = await adminService.syncProviderModels(provider.id);
      setNotice(`مزامنة ${provider.name}: نماذج مكتشفة ${result.discovered}، مضافة ${result.created}.${result.warning ? ` تنبيه: ${result.warning}` : ""}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذرت مزامنة النماذج.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleProvider = async (provider: ProviderRow) => {
    setBusyId(provider.id); setError(null); setNotice(null);
    try {
      await adminService.setProviderLifecycle(provider.id, !provider.enabled, hideModelsOnDisable);
      setNotice(`${provider.name}: تم ${provider.enabled ? "تعطيل" : "تفعيل"} المزود وكل نماذجه.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تغيير حالة المزود."); }
    finally { setBusyId(null); }
  };

  const removeProvider = async (provider: ProviderRow) => {
    const confirmed = await confirmAdminAction("حذف المزود", `سيُحذف ${provider.name} ومفتاحه وكل نماذجه نهائيًا.`, "حذف نهائي");
    if (!confirmed) return;
    setBusyId(provider.id); setError(null); setNotice(null);
    try { await adminService.deleteProvider(provider.id); setNotice(`تم حذف ${provider.name} ومفتاحه ونماذجه.`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حذف المزود."); }
    finally { setBusyId(null); }
  };

  const selectPreset = (preset: ProviderPreset) => {
    const existingCount = providers.filter((provider) => provider.provider_type === preset.type).length;
    let suffix = existingCount + 1;
    let defaultName = suffix === 1 ? preset.name : `${preset.name} · مفتاح ${suffix}`;
    while (providers.some((provider) => provider.name.trim().toLocaleLowerCase() === defaultName.toLocaleLowerCase())) {
      suffix += 1;
      defaultName = `${preset.name} · مفتاح ${suffix}`;
    }
    setSelectedType(preset.type);
    setName(defaultName);
    setBaseUrl(preset.baseUrl);
    setKey("");
    setError(null);
    setNotice(null);
    setShowAdvanced(Boolean(preset.requiresBaseUrl));
  };

  const testModel = async (model: ModelRow) => {
    setTestingModelId(model.id); setError(null);
    try {
      const result = await adminService.testModel(model.id);
      setTestResults((current) => ({
        ...current,
        [model.id]: result.status === "success" ? `نجح · ${result.duration_ms}ms` : probeErrorLabel(result.error_code),
      }));
    } catch (cause) {
      setTestResults((current) => ({ ...current, [model.id]: cause instanceof Error ? cause.message : "تعذر تشغيل الاختبار." }));
    } finally { setTestingModelId(null); }
  };

  const save = async () => {
    const preset = selectedPreset;
    if (!preset) { setError("اختر المزود من القائمة أولًا."); return; }
    const providerName = name.trim();
    if (!providerName) { setError("أدخل اسمًا مميزًا لهذا المفتاح، مثل «أساسي» أو «احتياطي»."); return; }
    if (providers.some((provider) => provider.name.trim().toLocaleLowerCase() === providerName.toLocaleLowerCase())) {
      setError("اسم هذا المفتاح مستخدم بالفعل. اختر اسمًا مختلفًا حتى لا تستبدل مفتاحًا محفوظًا."); return;
    }
    if (!key.trim()) { setError(`الصق مفتاح ${preset.name}. ${preset.keyHint}.`); return; }
    const url = baseUrl.trim();
    if (!url) { setError("هذا المزود يحتاج رابط HTTPS. اكتبه في الخيارات المتقدمة."); return; }
    try { if (new URL(url).protocol !== "https:") throw new Error(); }
    catch { setError("رابط المزود يجب أن يكون HTTPS صحيحًا."); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await adminService.createProvider({
        name: providerName,
        provider_type: preset.type,
        base_url: url,
        description: description.trim(),
        api_key: key.trim(),
      });
      setKey("");
      setNotice(`تمت إضافة حساب المفتاح «${providerName}». نماذج مكتشفة: ${result.discovered}، مضافة: ${result.created}.${result.warning ? ` تنبيه: ${result.warning}` : ""}`);
      setName("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشل حفظ المزود.");
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <PageHeader title="مزودو الخدمة" />
    <Text style={styles.explainer}>أضف أكثر من مفتاح للخدمة نفسها عند الحاجة. كل مفتاح يُحفظ كحساب مستقل، وتُربط به نماذجه وسجل صحته وحده؛ قيم المفاتيح لا تظهر بعد الحفظ.</Text>
    <Card><Toggle label="عند تعطيل مزود: إخفاء نماذجه من التوجيه" value={hideModelsOnDisable} onChange={setHideModelsOnDisable} /><Text style={styles.detail}>عند إيقاف هذا الخيار ستبقى النماذج ظاهرة في لوحة النماذج، لكنها لن تعمل ما دام المزود معطّلًا.</Text></Card>
    <Card>
      <View style={styles.providerFormHeading}><View style={styles.sectionIcon}><Text style={styles.sectionIconText}>⌘</Text></View><View style={styles.providerFormHeadingText}><Text style={styles.sectionTitle}>إضافة مفتاح API</Text><Text style={styles.detail}>كل إضافة تنشئ حسابًا ومجموعة نماذج مستقلين</Text></View></View>
      <Text style={styles.sectionTitle}>١. اختر الخدمة</Text>
      <View style={styles.rowWrap}>
        {providerPresets.map((preset) => (
          <Pressable
            key={preset.type}
            onPress={() => selectPreset(preset)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedType === preset.type }}
            style={[styles.preset, selectedType === preset.type && styles.presetSelected]}
          >
            <Text style={[styles.presetText, selectedType === preset.type && styles.presetTextSelected]}>{preset.name}</Text>
          </Pressable>
        ))}
      </View>
      {selectedPreset ? (
        <Text style={styles.hint}>
          {selectedPreset.requiresBaseUrl
            ? "أدخل رابط البوابة المتوافقة مع OpenAI في الخيارات المتقدمة."
            : `الرابط المستخدم: ${selectedPreset.baseUrl}`}
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>٢. سمّ هذا المفتاح</Text>
      <Text style={styles.detail}>مثال: «أساسي»، «احتياطي»، أو «فريق ٢». يمكنك إضافة مفتاح آخر للخدمة نفسها باسم مختلف.</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={selectedPreset ? `${selectedPreset.name} · أساسي` : "اختر الخدمة أولًا"} placeholderTextColor={colors.textMuted} maxLength={120} editable={Boolean(selectedPreset)} />

      <Text style={styles.sectionTitle}>٣. الصق مفتاح API</Text>
      <TextInput
        style={styles.input}
        value={key}
        onChangeText={setKey}
        placeholder={selectedPreset ? selectedPreset.keyHint : "اختر المزود أولًا"}
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={Boolean(selectedPreset)}
      />
      <Pressable onPress={() => setShowAdvanced((value) => !value)} accessibilityRole="button">
        <Text style={styles.link}>{showAdvanced ? "إخفاء الخيارات المتقدمة" : "خيارات متقدمة (الرابط والوصف)"}</Text>
      </Pressable>
      {showAdvanced ? <>
        <Text style={styles.label}>رابط الخدمة (HTTPS)</Text>
        <TextInput style={styles.input} value={baseUrl} onChangeText={setBaseUrl} placeholder="https://api.example.com/v1" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" />
        <Text style={styles.label}>وصف اختياري</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="ملاحظة داخلية" placeholderTextColor={colors.textMuted} />
      </> : null}
      <ErrorText>{error}</ErrorText>
      {notice && <Text style={styles.success}>{notice}</Text>}
      <PrimaryButton label={busy ? "جارٍ الحفظ ومزامنة النماذج…" : "إضافة المفتاح ومزامنة نماذجه"} onPress={() => void save()} disabled={busy || !selectedPreset || !key.trim() || !name.trim()} />
    </Card>
    <View style={styles.sectionRow}><View><Text style={styles.sectionTitle}>حسابات المفاتيح المسجلة</Text><Text style={styles.detail}>{providers.length} مفتاح · يمكن أن تتكرر النماذج بين مفاتيح مختلفة</Text></View><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.link}>تحديث</Text></Pressable></View>
    {loading ? <ActivityIndicator color={colors.primary} /> : providers.length === 0 ? <Text style={styles.detail}>لا يوجد مفتاح مسجل بعد. أضف مفتاحًا ليظهر حسابه ونماذجه هنا.</Text> : providers.map((provider) => {
      const modelsForProvider = providerModels.filter((model) => model.provider_id === provider.id);
      const routableCount = modelsForProvider.filter((model) => provider.enabled && model.enabled && model.routing_group !== "disabled" && !model.health?.auto_restricted).length;
      const restrictedCount = modelsForProvider.filter((model) => model.health?.auto_restricted).length;
      const expanded = expandedProviderId === provider.id;
      return <Card key={provider.id}>
        <View style={styles.providerCardHeader}><View style={styles.providerIcon}><Text style={styles.providerIconText}>⌘</Text></View><View style={styles.providerHeaderText}><Text style={styles.cardTitle}>{provider.name}</Text><Text style={styles.detail}>{provider.provider_type} · {provider.enabled ? "المفتاح مفعّل" : "المفتاح متوقف"} · اختبار المزود: {provider.last_test_status ?? "غير متاح"}</Text></View></View>
        <Text numberOfLines={1} style={styles.detail}>{provider.base_url ?? ""}</Text>
        <View style={styles.providerStatsRow}><Text style={styles.providerStat}>{modelsForProvider.length} نموذج مرتبط</Text><Text style={styles.providerStat}>{routableCount} جاهز للتوجيه</Text>{restrictedCount > 0 ? <Text style={styles.providerRestrictedStat}>{restrictedCount} مقيّد</Text> : null}</View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpandedProviderId(expanded ? null : provider.id)} style={styles.providerExpandAction}><Text style={styles.link}>{expanded ? "إخفاء نماذج هذا المفتاح" : `عرض نماذج هذا المفتاح (${modelsForProvider.length})`}</Text><Text style={styles.link}>{expanded ? "⌃" : "⌄"}</Text></Pressable>
        {expanded ? <View style={styles.providerModelsList}>
          {modelsForProvider.length === 0 ? <Text style={styles.detail}>لم تُكتشف نماذج لهذا المفتاح بعد. استخدم مزامنة النماذج.</Text> : modelsForProvider.map((model) => {
            const status = !provider.enabled ? "المفتاح متوقف" : model.health?.auto_restricted ? "مقيّد آليًا" : (!model.enabled || model.routing_group === "disabled") ? "معطّل يدويًا" : "جاهز للتوجيه";
            const statusStyle = !provider.enabled || !model.enabled || model.routing_group === "disabled" ? styles.statusDisabled : model.health?.auto_restricted ? styles.statusRestricted : styles.statusEnabled;
            const statusTextStyle = !provider.enabled || !model.enabled || model.routing_group === "disabled" ? styles.statusDisabledText : model.health?.auto_restricted ? styles.statusRestrictedText : styles.statusEnabledText;
            return <View key={model.id} style={styles.providerModelRow}>
              <View style={styles.providerModelHeader}><View style={[styles.statusBadge, statusStyle]}><Text style={[styles.statusBadgeText, statusTextStyle]}>{status}</Text></View><View style={styles.providerModelInfo}><Text style={styles.providerModelName}>{model.name}</Text><Text style={styles.providerModelIdentifier}>{model.model_identifier}</Text></View></View>
              <Text style={styles.detail}>المسار: {model.routing_group} · الأولوية: {model.priority}{model.probe?.last_scheduled_status ? ` · آخر فحص: ${model.probe.last_scheduled_status === "success" ? "ناجح" : "فاشل"}` : " · لم يُفحص دوريًا بعد"}</Text>
              {testResults[model.id] ? <Text style={testResults[model.id].startsWith("نجح") ? styles.success : styles.warning}>{testResults[model.id]}</Text> : null}
              <PrimaryButton label={testingModelId === model.id ? "جارٍ اختبار هذا النموذج…" : "اختبار النموذج بهذا المفتاح"} onPress={() => void testModel(model)} disabled={testingModelId !== null || busyId !== null} />
            </View>;
          })}
        </View> : null}
        <View style={styles.rowWrap}>
          <PrimaryButton label={busyId === provider.id ? "جارٍ التنفيذ…" : "مزامنة نماذج هذا المفتاح"} onPress={() => void syncProvider(provider)} disabled={busyId !== null || testingModelId !== null} />
          <PrimaryButton label={provider.enabled ? "إيقاف هذا المفتاح ونماذجه" : "تفعيل هذا المفتاح ونماذجه"} onPress={() => void toggleProvider(provider)} disabled={busyId !== null || testingModelId !== null} />
          <Pressable accessibilityRole="button" onPress={() => void removeProvider(provider)} disabled={busyId !== null || testingModelId !== null}><Text style={styles.error}>حذف المفتاح ونماذجه</Text></Pressable>
        </View>
      </Card>;
    })}
  </ScrollView>;
}

export function ModelsAdminScreen() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [search, setSearch] = useState("");
  const [modelFilter, setModelFilter] = useState<"all" | "enabled" | "disabled" | "restricted">("all");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testingModelId, setTestingModelId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<number, string>>({});

  const [freeTimeout, setFreeTimeout] = useState("5000");
  const [fallbackTimeout, setFallbackTimeout] = useState("30000");
  const [parallel, setParallel] = useState("10");
  const [paidFallback, setPaidFallback] = useState(true);
  const [autoRestrict, setAutoRestrict] = useState(true);
  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    return models.filter((model) => {
      const matchesQuery = !query || `${model.name} ${model.model_identifier} ${model.provider_name} ${model.routing_group}`.toLowerCase().includes(query);
      const matchesFilter = modelFilter === "all"
        || (modelFilter === "enabled" && model.provider_enabled !== false && model.enabled && model.routing_group !== "disabled" && !model.health?.auto_restricted)
        || (modelFilter === "disabled" && (model.provider_enabled === false || !model.enabled || model.routing_group === "disabled"))
        || (modelFilter === "restricted" && Boolean(model.health?.auto_restricted));
      return matchesQuery && matchesFilter;
    });
  }, [models, modelFilter, search]);

  // حالة تعديل النموذج المختار ومراجعة سجل محاولاته
  const [selectedModel, setSelectedModel] = useState<ModelRow | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [probeLogs, setProbeLogs] = useState<ProbeLogRow[]>([]);
  const [editTiers, setEditTiers] = useState<string[]>([]);
  const [editTimeout, setEditTimeout] = useState("30000");
  const [editThreshold, setEditThreshold] = useState("3");
  const [editWindow, setEditWindow] = useState("15");

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const result = await adminService.getModelsOverview();
      setModels(result.models as ModelRow[]);
      const config = result.settings as Record<string, unknown> | null;
      setSettings(config);
      if (config) {
        setFreeTimeout(String(config.free_race_timeout_ms ?? 5000));
        setFallbackTimeout(String(config.paid_fallback_timeout_ms ?? 30000));
        setParallel(String(config.max_parallel_free_models ?? 10));
        setPaidFallback(config.paid_fallback_enabled === true);
        setAutoRestrict(config.health_auto_restrict_enabled !== false);
      }
    } catch { setError("تعذر تحميل النماذج أو إعدادات التوجيه."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const openModelDetails = async (model: ModelRow) => {
    setSelectedModel(model);
    setEditTiers(model.allowed_tiers ?? ["free", "lite", "pro", "max"]);
    setEditTimeout(String(model.response_timeout_ms ?? 30000));
    setEditThreshold(String(model.restriction_failure_threshold ?? 3));
    setEditWindow(String(model.restriction_window_minutes ?? 15));
    try {
      const [logs, probes] = await Promise.all([adminService.getModelAttempts(model.id), adminService.getModelProbeLogs(model.id)]);
      setAttempts(logs as AttemptRow[]);
      setProbeLogs(probes as ProbeLogRow[]);
    } catch {
      setAttempts([]);
      setProbeLogs([]);
    }
  };

  const saveModelDetail = async () => {
    if (!selectedModel) return;
    const timeout = Number(editTimeout), threshold = Number(editThreshold), window = Number(editWindow);
    if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120000 || !Number.isInteger(threshold) || threshold < 1 || !Number.isInteger(window) || window < 1) {
      setError("المهلة 1000-120000، العتبة والنطاق أعداد صحيحة موجبة.");
      return;
    }
    setBusy(true); setError(null);
    try {
      await adminService.updateModel(selectedModel.id, {
        allowed_tiers: editTiers,
        response_timeout_ms: timeout,
        restriction_failure_threshold: threshold,
        restriction_window_minutes: window,
      });
      setSelectedModel(null);
      await load();
    } catch {
      setError("تعذر تحديث إعدادات النموذج الفردية.");
    } finally {
      setBusy(false);
    }
  };

  const toggleTier = (tier: string) => {
    setEditTiers((prev) => prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]);
  };

  const saveSettings = async () => {
    const free = Number(freeTimeout), fallback = Number(fallbackTimeout), count = Number(parallel);
    if (!Number.isInteger(free) || free < 1000 || free > 30000 || !Number.isInteger(fallback) || fallback < 1000 || fallback > 120000 || !Number.isInteger(count) || count < 1 || count > 50) { setError("المهلة المجانية 1000–30000، مهلة البديل 1000–120000، والتوازي 1–50."); return; }
    setBusy(true); setError(null);
    try { await adminService.updateRouterSettings({ free_race_timeout_ms: free, paid_fallback_timeout_ms: fallback, max_parallel_free_models: count, paid_fallback_enabled: paidFallback, health_auto_restrict_enabled: autoRestrict }); setError(null); await load(); }
    catch { setError("تعذر حفظ إعدادات التوجيه عبر قاعدة البيانات."); }
    finally { setBusy(false); }
  };

  const disable = async (model: ModelRow) => {
    if (!await confirmAdminAction("تعطيل النموذج؟", `سيُزال ${model.name} من التوجيه.`, "تعطيل النموذج")) return;
    setBusy(true);
    try { await adminService.updateModel(model.id, { enabled: false, routing_group: "disabled" }); await load(); }
    catch { setError("تعذر تعطيل النموذج."); }
    finally { setBusy(false); }
  };

  const assignRoute = async (model: ModelRow, route: "free_race" | "paid_fallback") => {
    if (!await confirmAdminAction("تفعيل النموذج؟", `سيُفعّل ${model.name} ضمن مسار ${route}.`, "تفعيل")) return;
    setBusy(true);
    try { await adminService.updateModel(model.id, { enabled: true, routing_group: route }); await load(); }
    catch { setError("تعذر تحديث مسار النموذج."); }
    finally { setBusy(false); }
  };

  const resetHealth = async (model: ModelRow) => {
    if (!await confirmAdminAction("إعادة ضبط صحة النموذج؟", `سيُصفّر هذا الإجراء عداد الإخفاق ويعيد تفعيل ${model.name} في قاعدة البيانات.`, "إعادة الضبط")) return;
    setBusy(true);
    try { await adminService.resetModelHealth(model.id); await load(); }
    catch { setError("تعذر إعادة ضبط سجل صحة النموذج."); }
    finally { setBusy(false); }
  };

  const testModel = async (model: ModelRow) => {
    setTestingModelId(model.id); setError(null);
    try {
      const result = await adminService.testModel(model.id);
      setTestResults((current) => ({
        ...current,
        [model.id]: result.status === "success" ? `نجح الاختبار · ${result.duration_ms}ms` : probeErrorLabel(result.error_code),
      }));
      await load();
    } catch (cause) {
      setTestResults((current) => ({ ...current, [model.id]: cause instanceof Error ? cause.message : "تعذر تشغيل الاختبار." }));
    } finally { setTestingModelId(null); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <PageHeader title="النماذج والتوجيه" />
    <ErrorText>{error}</ErrorText>
    {loading ? <ActivityIndicator color={colors.primary} /> : <>
      <Card><View style={styles.healthProbeHeading}><View style={styles.sectionIcon}><Text style={styles.sectionIconText}>ϟ</Text></View><View style={styles.settingsHeadingText}><Text style={styles.sectionTitle}>مراقبة صحة النماذج</Text><Text style={styles.detail}>فحص تلقائي يوميًا الساعة 02:00 UTC لكل نموذج مفعّل ولكل مفتاح مرتبط به. يستخدم طلبًا قصيرًا بحد أقصى 16 token، ولا يخصم رصيد المستخدم؛ قد يستهلك استخدامًا لدى مزود الخدمة.</Text></View></View><Text style={styles.detail}>بعد 3 إخفاقات فحص متتالية يُستبعد النموذج آليًا من التوجيه، ويعود بعد نجاح فحصين متتاليين. الإيقاف اليدوي لا يُلغى بالفحص.</Text></Card>
      {settings && <Card><View style={styles.settingsHeading}><View style={styles.sectionIcon}><Text style={styles.sectionIconText}>⚙</Text></View><View style={styles.settingsHeadingText}><Text style={styles.sectionTitle}>إعدادات التوجيه</Text><Text style={styles.detail}>ai_router_settings · تؤثر على اختيار النماذج وتوازي الطلبات</Text></View></View><View style={styles.settingsFields}><NumberField label="مهلة سباق النماذج (ms)" value={freeTimeout} onChange={setFreeTimeout} /><NumberField label="مهلة البديل المدفوع (ms)" value={fallbackTimeout} onChange={setFallbackTimeout} /><NumberField label="أقصى نماذج متوازية" value={parallel} onChange={setParallel} /></View><View style={styles.settingsToggles}><Toggle label="تفعيل البديل المدفوع" value={paidFallback} onChange={setPaidFallback} /><Toggle label="التقييد التلقائي للصحة" value={autoRestrict} onChange={setAutoRestrict} /></View><PrimaryButton label={busy ? "جارٍ الحفظ…" : "✓  حفظ إعدادات التوجيه"} onPress={() => void saveSettings()} disabled={busy} /></Card>}
      <View style={styles.modelsSectionHeader}><View style={styles.modelsHeadingCopy}><Text style={styles.sectionTitle}>كتالوج النماذج</Text><Text style={styles.detail}>إدارة الحالة ومسار التوجيه والقيود وسجل الصحة</Text></View><View style={styles.totalBadge}><Text style={styles.totalBadgeText}>{models.length} نموذج</Text></View></View>
      <View style={styles.searchWrap}><Text style={styles.searchGlyph}>⌕</Text><TextInput style={[styles.input, styles.modelSearchInput]} value={search} onChangeText={setSearch} placeholder="ابحث بالاسم أو المزود أو المسار" placeholderTextColor={colors.textMuted} autoCapitalize="none" /><Pressable accessibilityRole="button" onPress={() => setSearch("")}><Text style={styles.link}>مسح</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {([
          ["all", `الكل · ${models.length}`],
          ["enabled", `جاهزة · ${models.filter((model) => model.provider_enabled !== false && model.enabled && model.routing_group !== "disabled" && !model.health?.auto_restricted).length}`],
          ["disabled", `معطّلة · ${models.filter((model) => model.provider_enabled === false || !model.enabled || model.routing_group === "disabled").length}`],
          ["restricted", `مقيّدة · ${models.filter((model) => model.health?.auto_restricted).length}`],
        ] as const).map(([filter, label]) => <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: modelFilter === filter }} onPress={() => setModelFilter(filter)} style={[styles.filterChip, modelFilter === filter && styles.filterChipSelected]}><Text style={[styles.filterText, modelFilter === filter && styles.filterTextSelected]}>{label}</Text></Pressable>)}
      </ScrollView>
      <Text style={styles.resultsCount}>عرض {filteredModels.length} من {models.length}</Text>
      {filteredModels.length === 0 ? <Card><Text style={styles.emptyIcon}>⌕</Text><Text style={styles.detail}>لا توجد نماذج تطابق البحث أو عامل التصفية المحدد.</Text></Card> : null}
      {filteredModels.map((model) => {
        const providerIsOff = model.provider_enabled === false;
        const isManuallyOff = !model.enabled || model.routing_group === "disabled";
        const status = model.health?.auto_restricted ? "مقيّد آليًا" : providerIsOff ? "المفتاح متوقف" : isManuallyOff ? "معطّل يدويًا" : "جاهز للتوجيه";
        const statusStyle = model.health?.auto_restricted ? styles.statusRestricted : providerIsOff || isManuallyOff ? styles.statusDisabled : styles.statusEnabled;
        const statusTextStyle = model.health?.auto_restricted ? styles.statusRestrictedText : providerIsOff || isManuallyOff ? styles.statusDisabledText : styles.statusEnabledText;
        const scheduledStatus = model.probe?.last_scheduled_status === "success" ? "ناجح" : model.probe?.last_scheduled_status === "error" ? "فاشل" : "لم يُفحص بعد";
        return <Card key={model.id}>
          <View style={styles.modelCardHeader}>
            <View style={[styles.statusBadge, statusStyle]}><Text style={[styles.statusBadgeText, statusTextStyle]}>{status}</Text></View>
            <View style={styles.modelNameBlock}><Text style={styles.cardTitle}>{model.name}</Text><Text style={styles.detail}>{model.provider_name} · {model.model_identifier}</Text></View>
          </View>
          <View style={styles.modelMetaRow}><View style={styles.metaBadge}><Text style={styles.metaBadgeText}>{providerIsOff ? "⏸ المفتاح متوقف" : isManuallyOff ? "⏸ خارج التوجيه" : `⇢ ${model.routing_group === "free_race" ? "سباق مجاني" : model.routing_group === "paid_fallback" ? "بديل مدفوع" : model.routing_group}`}</Text></View><View style={styles.metaBadge}><Text style={styles.metaBadgeText}>أولوية {model.priority}</Text></View></View>
          <View style={styles.modelDetailsBox}><Text style={styles.detail}>الشرائح المسموحة: {(model.allowed_tiers ?? ["free", "lite", "pro", "max"]).join(" · ")}</Text><Text style={styles.detail}>مهلة الاستجابة: {model.response_timeout_ms ?? 30000}ms</Text><Text style={styles.detail}>صحة طلبات المستخدمين: {model.health?.last_status ?? "غير مسجلة"} · إخفاقات: {model.health?.consecutive_failures ?? 0}</Text><Text style={styles.detail}>آخر فحص دوري: {scheduledStatus} · إخفاقات الفحص المتتالية: {model.probe?.consecutive_scheduled_failures ?? 0}</Text></View>
          {testResults[model.id] ? <View style={styles.probeFeedback}><Text style={testResults[model.id].startsWith("نجح") ? styles.success : styles.warning}>{testResults[model.id]}</Text></View> : null}
          {model.health?.restriction_reason ? <View style={styles.warningBox}><Text style={styles.warning}>⚠  {model.health.restriction_reason}</Text></View> : null}
          <View style={styles.rowWrap}>
            <Pressable accessibilityRole="button" onPress={() => void openModelDetails(model)} style={styles.detailsAction}><Text style={styles.link}>⚙  القيود وسجل الفحوص</Text></Pressable>
            <PrimaryButton label={testingModelId === model.id ? "جارٍ الفحص…" : "اختبار بهذا المفتاح"} onPress={() => void testModel(model)} disabled={busy || testingModelId !== null} />
            {model.health?.auto_restricted ? <PrimaryButton label="مراجعة وإعادة تفعيل" onPress={() => void resetHealth(model)} disabled={busy || testingModelId !== null} /> : providerIsOff ? <Link href="/admin/api-keys" asChild><Pressable style={styles.detailsAction}><Text style={styles.link}>اذهب لتفعيل المفتاح</Text></Pressable></Link> : isManuallyOff ? <><PrimaryButton label="تفعيل ضمن سباق مجاني" onPress={() => void assignRoute(model, "free_race")} disabled={busy || testingModelId !== null} /><PrimaryButton label="تفعيل كبديل مدفوع" onPress={() => void assignRoute(model, "paid_fallback")} disabled={busy || testingModelId !== null} /></> : <PrimaryButton label="تعطيل" onPress={() => void disable(model)} disabled={busy || testingModelId !== null} />}
          </View>
        </Card>;
      })}
    </>}

    {/* Modal لتعديل النموذج الفردي واستعراض سجل محاولاته */}
    <Modal visible={!!selectedModel} transparent animationType="fade" onRequestClose={() => setSelectedModel(null)}>
      <View style={styles.modalBackdrop}>
        <ScrollView style={styles.modalScrollContent} contentContainerStyle={styles.modalCard}>
          <View style={styles.modalHeading}><View style={styles.sectionIcon}><Text style={styles.sectionIconText}>◈</Text></View><View style={styles.modalHeadingText}><Text style={styles.sectionTitle}>إعدادات النموذج</Text><Text style={styles.detail}>{selectedModel?.name}</Text></View></View>
          <Text style={styles.detail}>الشرائح المسموحة allowed_tiers:</Text>
          <View style={styles.rowWrap}>
            {["free", "lite", "pro", "max"].map((tier) => (
              <Pressable key={tier} onPress={() => toggleTier(tier)} style={[styles.pill, editTiers.includes(tier) && styles.pillSelected]}>
                <Text style={styles.pillText}>{tier}</Text>
              </Pressable>
            ))}
          </View>
          <NumberField label="مهلة الاستجابة response_timeout_ms" value={editTimeout} onChange={setEditTimeout} />
          <NumberField label="عتبة الإخفاق للتقييد failure_threshold" value={editThreshold} onChange={setEditThreshold} />
          <NumberField label="نافذة الحظر بالدقائق window_minutes" value={editWindow} onChange={setEditWindow} />
          <PrimaryButton label="حفظ إعدادات النموذج" onPress={() => void saveModelDetail()} disabled={busy} />

          <View style={styles.attemptsHeading}><Text style={styles.sectionTitle}>سجل المحاولات الحديثة</Text><View style={styles.totalBadge}><Text style={styles.totalBadgeText}>{attempts.length}</Text></View></View>
          {attempts.length === 0 ? <Text style={styles.detail}>لا توجد محاولات حديثة مسجلة لهذا النموذج.</Text> : attempts.map((log, index) => (
            <View key={index} style={styles.attemptRow}>
              <View style={styles.attemptMeta}><Text style={[styles.attemptStatus, log.attempt_status.toLowerCase().includes("success") ? styles.statusEnabledText : styles.statusDisabledText]}>{log.attempt_status}</Text><Text style={styles.detail}>{log.duration_ms ?? "—"}ms</Text></View><Text style={styles.detail}>{log.created_at}</Text>
              {log.error_reason && <Text style={styles.warning}>{log.error_code ?? "خطأ"}: {log.error_reason}</Text>}
            </View>
          ))}

          <View style={styles.attemptsHeading}><Text style={styles.sectionTitle}>سجل فحوص النموذج والمفتاح</Text><View style={styles.totalBadge}><Text style={styles.totalBadgeText}>{probeLogs.length}</Text></View></View>
          {probeLogs.length === 0 ? <Text style={styles.detail}>لا يوجد فحص دوري أو يدوي مسجل بعد.</Text> : probeLogs.map((log, index) => (
            <View key={`${log.checked_at}-${index}`} style={styles.attemptRow}>
              <View style={styles.attemptMeta}><Text style={[styles.attemptStatus, log.status === "success" ? styles.statusEnabledText : log.status === "error" ? styles.warning : styles.statusDisabledText]}>{log.status === "success" ? "ناجح" : log.status === "error" ? "فاشل" : "تخطّي"} · {log.run_type === "scheduled" ? "دوري" : "يدوي"}</Text><Text style={styles.detail}>{log.duration_ms}ms</Text></View>
              <Text style={styles.detail}>{new Date(log.checked_at).toLocaleString("ar-EG")}</Text>
              {log.error_code ? <Text style={styles.warning}>{probeErrorLabel(log.error_code)}</Text> : null}
            </View>
          ))}

          <Pressable onPress={() => setSelectedModel(null)} style={styles.modalClose}><Text style={styles.link}>إغلاق</Text></Pressable>
        </ScrollView>
      </View>
    </Modal>
  </ScrollView>;
}

export function UsersAdminScreen() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [transactions, setTransactions] = useState<Record<string, TransactionRow[]>>({});
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return query ? users.filter((user) => `${user.email} ${user.full_name ?? ""} ${user.id}`.toLowerCase().includes(query)) : users; }, [users, search]);
  const load = async () => { setLoading(true); setError(null); try { setUsers((await adminService.getUsers()) as UserRow[]); } catch { setError("تعذر تحميل المستخدمين. تحقق من الصلاحية وRLS."); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const toggleBan = async (user: UserRow) => {
    const next = !user.is_banned;
    if (!await confirmAdminAction(next ? "حظر المستخدم؟" : "إلغاء الحظر؟", `${user.email} ${next ? "لن يستطيع استخدام الخدمة." : "سيتمكن من استخدام الخدمة مجددًا."}`, "تأكيد")) return;
    try { await adminService.setUserBanned(user.id, next); await load(); }
    catch { setError("تعذر تعديل حالة الحظر. قد يمنع backend حظر حساب مشرف."); }
  };
  const showTransactions = async (user: UserRow) => {
    try { const rows = await adminService.getUserTransactions(user.id) as TransactionRow[]; setTransactions((current) => ({ ...current, [user.id]: rows })); }
    catch { setError("تعذر تحميل سجل معاملات المستخدم."); }
  };
  const applyAdjustment = async () => {
    if (!selected) return;
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value === 0 || !reason.trim()) { setError("أدخل مبلغًا صحيحًا غير صفري وسببًا إلزاميًا."); return; }
    if (!await confirmAdminAction("تأكيد تعديل الرصيد؟", `سيُسجل تعديل ${value} رصيد للمستخدم ${selected.email}. السبب: ${reason.trim()}`, "تنفيذ التعديل")) return;
    try {
      const result = await adminService.adjustCredits(selected.id, value, reason.trim());
      if (result.success !== true) { setError(result.error === "insufficient_credits" ? "الرصيد المتاح لا يكفي لهذا الخصم." : "رفضت قاعدة البيانات تعديل الرصيد."); return; }
      setSelected(null); setAmount(""); setReason(""); await load();
    } catch { setError("فشل تعديل الرصيد. لم تُنفذ كتابة مباشرة على جدول الحسابات."); }
  };
  return <View style={styles.screen}>
    <PageHeader title="إدارة المستخدمين" />
    <View style={styles.searchWrap}><TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="ابحث بالاسم أو البريد أو UUID" placeholderTextColor={colors.textMuted} autoCapitalize="none" /><Pressable onPress={() => void load()}><Text style={styles.link}>تحديث</Text></Pressable></View>
    <ErrorText>{error}</ErrorText>
    {loading ? <ActivityIndicator color={colors.primary} /> : <FlatList data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} renderItem={({ item }) => <Card>
      <Text style={styles.cardTitle}>{item.full_name || item.email || item.id}</Text><Text style={styles.detail}>{item.email} · {item.subscription_tier ?? "free"}</Text><Text style={styles.detail}>الرصيد {item.balance} · المحجوز {item.reserved_balance} · {item.is_banned ? "محظور" : "نشط"}</Text><Text selectable style={styles.idText}>{item.id}</Text>
      <View style={styles.rowWrap}><Pressable onPress={() => void toggleBan(item)}><Text style={item.is_banned ? styles.success : styles.warning}>{item.is_banned ? "إلغاء الحظر" : "حظر"}</Text></Pressable><Pressable onPress={() => { setSelected(item); setAmount(""); setReason(""); }}><Text style={styles.link}>تعديل الرصيد</Text></Pressable><Pressable onPress={() => void showTransactions(item)}><Text style={styles.link}>سجل المعاملات</Text></Pressable></View>
      {transactions[item.id]?.map((tx, index) => <Text key={`${tx.id ?? tx.created_at}-${index}`} style={styles.detail}>{tx.event_type} · {tx.amount} · الرصيد {tx.balance_after} · {tx.created_at}</Text>)}
    </Card>} />}
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.sectionTitle}>تعديل رصيد {selected?.email}</Text><TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="المبلغ (+ إضافة، - خصم)" placeholderTextColor={colors.textMuted} /><TextInput style={styles.input} value={reason} onChangeText={setReason} maxLength={500} placeholder="السبب الإلزامي" placeholderTextColor={colors.textMuted} /><PrimaryButton label="مراجعة وتنفيذ" onPress={() => void applyAdjustment()} /><Pressable onPress={() => setSelected(null)} style={styles.modalClose}><Text style={styles.link}>إلغاء</Text></Pressable></View></View></Modal>
  </View>;
}

export function CreditManagementAdminScreen() {
  const [pricing, setPricing] = useState<Record<string, unknown> | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [minimum, setMinimum] = useState("10");
  const [inputRate, setInputRate] = useState("0");
  const [outputRate, setOutputRate] = useState("0");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => { setLoading(true); setError(null); try { const data = await adminService.getCreditOverview(); setPricing(data.pricing as Record<string, unknown> | null); setTransactions(data.transactions as TransactionRow[]); if (data.pricing) { setEnabled(data.pricing.enabled === true); setMinimum(String(data.pricing.minimum_request_credits ?? 10)); setInputRate(String(data.pricing.input_credits_per_1k_tokens ?? 0)); setOutputRate(String(data.pricing.output_credits_per_1k_tokens ?? 0)); } } catch { setError("تعذر تحميل تسعير الرصيد والمعاملات."); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const save = async () => { const min = Number(minimum), input = Number(inputRate), output = Number(outputRate); if (![min, input, output].every((number) => Number.isSafeInteger(number) && number >= 0 && number <= 1_000_000_000)) { setError("أدخل أعدادًا صحيحة بين صفر ومليار."); return; } setBusy(true); setError(null); try { const result = await adminService.updateCreditPricing({ enabled, minimum: min, inputRate: input, outputRate: output }); if (result.success !== true) throw new Error(); await load(); } catch { setError("تعذر حفظ الأسعار عبر RPC الإدارية."); } finally { setBusy(false); } };
  const settlements = transactions.filter((row) => row.event_type === "settle");
  const billed = settlements.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const tokens = settlements.reduce((sum, row) => sum + Number(row.input_tokens ?? 0) + Number(row.output_tokens ?? 0), 0);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><PageHeader title="إدارة الرصيد" /><ErrorText>{error}</ErrorText>{loading ? <ActivityIndicator color={colors.primary} /> : <>
    {!pricing && <Text style={styles.warning}>لم يعثر التطبيق على إعداد التسعير. لن يُنشئ إعدادًا مفترضًا.</Text>}
    <Card><Text style={styles.sectionTitle}>تسعير الرصيد</Text><Text style={styles.detail}>الأسعار تخص الطلبات الجديدة ويُطبقها ai-router. مجموع المؤشرات أدناه مبني على آخر 100 معاملة فقط.</Text><Toggle label="تفعيل الخصم" value={enabled} onChange={setEnabled} /><NumberField label="الحد الأدنى لكل طلب" value={minimum} onChange={setMinimum} /><NumberField label="رصيد لكل 1,000 token إدخال" value={inputRate} onChange={setInputRate} /><NumberField label="رصيد لكل 1,000 token إخراج" value={outputRate} onChange={setOutputRate} /><PrimaryButton label={busy ? "جارٍ الحفظ…" : "حفظ عبر RPC"} onPress={() => void save()} disabled={busy || !pricing} /></Card>
    <Card><Text style={styles.sectionTitle}>آخر 100 معاملة</Text><Text style={styles.detail}>تسويات: {settlements.length} · الرصيد المحصل: {billed} · tokens المسجلة: {tokens} · حجوزات: {transactions.filter((row) => row.event_type === "reserve").length}</Text></Card>
    {transactions.map((row, index) => <Card key={`${row.id ?? row.created_at}-${index}`}><Text style={styles.cardTitle}>{row.event_type} · {row.amount}</Text><Text style={styles.detail}>رصيد ما بعد العملية: {row.balance_after} · source: {row.source ?? "—"}</Text><Text style={styles.detail}>المستخدم: {row.user_id ?? "—"} · {row.created_at}</Text>{row.reason && <Text style={styles.detail}>السبب: {row.reason}</Text>}</Card>)}
  </>}</ScrollView>;
}

export function PricingAdminScreen() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { price: string; max_requests: string; daily_credits: string }>>({});
  const [adMobSettings, setAdMobSettings] = useState({ appId: "", rewardedUnitId: "", bannerUnitId: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [loadedPlans, loadedAdMobSettings] = await Promise.all([adminService.getPricingPlans(), adminService.getAdMobSettings()]);
      setPlans(loadedPlans);
      setDrafts(Object.fromEntries(loadedPlans.map((plan) => [plan.id, { price: String(plan.price), max_requests: String(plan.max_requests), daily_credits: String(plan.daily_credits) }])));
      setAdMobSettings(loadedAdMobSettings);
    } catch { setError("تعذر تحميل الباقات أو إعداد AdMob. تحقق من migration والصلاحية."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const updateDraft = (planId: number, key: "price" | "max_requests" | "daily_credits", value: string) => {
    const draftKey = String(planId);
    setDrafts((current) => ({ ...current, [draftKey]: { ...current[draftKey], [key]: value } }));
  };
  const save = async () => {
    const values = plans.map((plan) => {
      const draft = drafts[plan.id];
      return { plan, price: Number(draft?.price), max_requests: Number(draft?.max_requests), daily_credits: Number(draft?.daily_credits) };
    });
    if (values.some(({ price, max_requests, daily_credits }) => !Number.isFinite(price) || price < 0 || !Number.isInteger(max_requests) || max_requests < 0 || !Number.isInteger(daily_credits) || daily_credits < 0)) {
      setError("كل الأسعار والحدود يجب أن تكون أرقامًا غير سالبة، والحدود أعدادًا صحيحة."); return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      await Promise.all(values.map(({ plan, price, max_requests, daily_credits }) => adminService.updatePricingPlan(plan.id, { price, max_requests, daily_credits })));
      await adminService.updateAdMobSettings(adMobSettings);
      setNotice("تم حفظ الباقات وإعداد AdMob بنجاح.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ إعدادات الباقات."); }
    finally { setBusy(false); }
  };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <PageHeader title="إدارة الباقات والأسعار" />
    <Text style={styles.explainer}>تُحفظ التعديلات مباشرة في Supabase، وتظل الكتابة محمية بـ suly_is_admin وسياسات RLS.</Text>
    <ErrorText>{error}</ErrorText>
    {notice && <Text style={styles.success}>{notice}</Text>}
    {loading ? <ActivityIndicator color={colors.primary} /> : <>
      {plans.map((plan) => {
        const draft = drafts[plan.id];
        return <Card key={plan.id}>
          <Text style={styles.cardTitle}>{plan.name} ({plan.id})</Text>
          <NumberField label="السعر" value={draft?.price ?? ""} onChange={(value) => updateDraft(plan.id, "price", value)} />
          <NumberField label="الحد الأقصى للطلبات" value={draft?.max_requests ?? ""} onChange={(value) => updateDraft(plan.id, "max_requests", value)} />
          <NumberField label="الرصيد اليومي" value={draft?.daily_credits ?? ""} onChange={(value) => updateDraft(plan.id, "daily_credits", value)} />
        </Card>;
      })}
      <Card>
        <Text style={styles.sectionTitle}>إعدادات الإدارة</Text>
        <Text style={styles.label}>AdMob App ID</Text>
        <TextInput style={styles.input} value={adMobSettings.appId} onChangeText={(val) => setAdMobSettings(s => ({ ...s, appId: val }))} placeholder="ca-app-pub-..." placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
        <Text style={styles.label}>Rewarded Ad Unit ID</Text>
        <TextInput style={styles.input} value={adMobSettings.rewardedUnitId} onChangeText={(val) => setAdMobSettings(s => ({ ...s, rewardedUnitId: val }))} placeholder="ca-app-pub-..." placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
        <Text style={styles.label}>Banner Ad Unit ID</Text>
        <TextInput style={styles.input} value={adMobSettings.bannerUnitId} onChangeText={(val) => setAdMobSettings(s => ({ ...s, bannerUnitId: val }))} placeholder="ca-app-pub-..." placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
        <PrimaryButton label={busy ? "جارٍ الحفظ…" : "حفظ الباقات والإعدادات"} onPress={() => void save()} disabled={busy} />
      </Card>
    </>}
  </ScrollView>;
}

export function CircuitBreakerAdminScreen() {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><PageHeader title="قاطع الدائرة" /><Card><Text style={styles.sectionTitle}>غير مكتمل في تطبيق Flutter الحالي</Text><Text style={styles.detail}>المكوّن الحالي في Flutter يعرض ثلاثة تنبيهات ثابتة مع أزرار بلا تنفيذ. لذلك لم تُنقل بيانات تجريبية ولم تُعرض إجراءات إعادة تفعيل أو حذف غير مدعومة هنا.</Text><Text style={styles.detail}>لرؤية صحة النماذج الفعلية واستخدام إجراء إعادة الضبط المدعوم، افتح شاشة «النماذج والتوجيه».</Text><Link href="/admin/models" asChild><Pressable><Text style={styles.link}>الانتقال إلى النماذج والتوجيه</Text></Pressable></Link></Card></ScrollView>;
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="numeric" /></View>;
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <View style={styles.toggle}><Text style={styles.label}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 16, gap: 10 },
  healthProbeHeading: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 11 },
  providerFormHeading: { flexDirection: "row-reverse", alignItems: "center", gap: 11, marginBottom: 8 },
  providerFormHeadingText: { flex: 1, gap: 3 },
  providerCardHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  providerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  providerIconText: { color: colors.primary, fontSize: 19, fontWeight: "700" },
  providerHeaderText: { flex: 1, gap: 3, alignItems: "flex-end" },
  providerStatsRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, paddingVertical: 5 },
  providerStat: { color: colors.textSecondary, fontSize: 11, backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  providerRestrictedStat: { color: colors.warning, fontSize: 11, backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  providerExpandAction: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 6 },
  providerModelsList: { gap: 9, paddingTop: 7 },
  providerModelRow: { borderWidth: 1, borderColor: colors.divider, borderRadius: 11, padding: 11, gap: 6, backgroundColor: colors.cardBackground },
  providerModelHeader: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  providerModelInfo: { flex: 1, alignItems: "flex-end", gap: 2 },
  providerModelName: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "right" },
  providerModelIdentifier: { color: colors.textMuted, fontSize: 11, textAlign: "right" },
  probeFeedback: { borderRightWidth: 3, borderRightColor: colors.primary, backgroundColor: colors.surfaceElevated, borderRadius: 5, paddingHorizontal: 8 },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  back: { color: colors.accent, fontSize: 13 },
  pageTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: "800", textAlign: "right" },
  explainer: { color: colors.textSecondary, lineHeight: 21, textAlign: "right", marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 16, gap: 8 },
  cardTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 16, textAlign: "right" },
  sectionTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 18, textAlign: "right" },
  settingsHeading: { flexDirection: "row-reverse", alignItems: "center", gap: 11, marginBottom: 4 },
  settingsHeadingText: { flex: 1, gap: 3 },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  sectionIconText: { color: colors.primary, fontSize: 19, fontWeight: "700" },
  settingsFields: { gap: 2, paddingVertical: 6 },
  settingsToggles: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 6 },
  modelsSectionHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 10 },
  modelsHeadingCopy: { flex: 1, gap: 3 },
  totalBadge: { borderRadius: 20, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 10, paddingVertical: 5 },
  totalBadgeText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  modelSearchInput: { flex: 1, marginVertical: 0 },
  searchGlyph: { color: colors.primary, fontSize: 20, fontWeight: "700" },
  filterRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 3 },
  filterChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  filterChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  filterTextSelected: { color: colors.textPrimary },
  resultsCount: { color: colors.textMuted, fontSize: 11, textAlign: "right", marginTop: -4 },
  emptyIcon: { color: colors.textMuted, fontSize: 26, textAlign: "center" },
  modelCardHeader: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },
  modelNameBlock: { flex: 1, gap: 3, alignItems: "flex-end" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  statusEnabled: { backgroundColor: colors.surfaceElevated, borderColor: colors.success },
  statusDisabled: { backgroundColor: colors.surfaceElevated, borderColor: colors.divider },
  statusRestricted: { backgroundColor: colors.surfaceElevated, borderColor: colors.warning },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  statusEnabledText: { color: colors.success },
  statusDisabledText: { color: colors.textMuted },
  statusRestrictedText: { color: colors.warning },
  modelMetaRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  metaBadge: { backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  metaBadgeText: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  modelDetailsBox: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 7, gap: 2 },
  warningBox: { backgroundColor: colors.surfaceElevated, borderRightWidth: 3, borderRightColor: colors.warning, paddingHorizontal: 9, borderRadius: 5 },
  detailsAction: { borderWidth: 1, borderColor: colors.divider, borderRadius: 9, paddingHorizontal: 9 },
  detail: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: "right" },
  label: { color: colors.textSecondary, textAlign: "right", flex: 1 },
  input: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, paddingHorizontal: 12, color: colors.textPrimary, textAlign: "auto", marginVertical: 4 },
  field: { marginTop: 5 },
  toggle: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  preset: { borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inputBackground, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8, marginBottom: 8 },
  presetSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  presetText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  presetTextSelected: { color: colors.textPrimary },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: "right", marginVertical: 6 },
  pill: { borderRadius: 20, borderWidth: 1, borderColor: colors.divider, paddingVertical: 7, paddingHorizontal: 10 },
  pillSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
  pillText: { color: colors.textPrimary, fontSize: 12 },
  button: { minHeight: 42, borderRadius: 9, backgroundColor: colors.primary, paddingHorizontal: 12, justifyContent: "center", alignItems: "center", marginTop: 7 },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.textPrimary, fontWeight: "700", textAlign: "center" },
  error: { color: colors.error, textAlign: "right", marginVertical: 6 },
  success: { color: colors.success, textAlign: "right" },
  warning: { color: colors.warning, textAlign: "right", marginVertical: 5 },
  link: { color: colors.accent, paddingVertical: 5 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  idText: { color: colors.textMuted, fontSize: 11, textAlign: "right" },
  modalBackdrop: { flex: 1, backgroundColor: colors.modalOverlay, justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 600, backgroundColor: colors.surface, borderRadius: 16, padding: 18, gap: 10 },
  modalScrollContent: { maxHeight: "90%", width: "100%" },
  modalClose: { alignItems: "center", padding: 8, marginTop: 12 },
  modalHeading: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: colors.divider },
  modalHeadingText: { flex: 1, gap: 3 },
  attemptsHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  attemptMeta: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 },
  attemptStatus: { fontSize: 12, fontWeight: "700" },
  attemptRow: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 3 },
});
