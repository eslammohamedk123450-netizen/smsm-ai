import { useEffect, useMemo, useState } from "react";
import { Link } from "expo-router";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { adminService } from "./admin-service";
import { providerPresets, findPreset, type ProviderPreset } from "./provider-presets";
import { confirmAdminAction } from "./admin-confirm";
import { colors } from "../../theme/colors";

type ProviderRow = { id: number; name: string; provider_type: string; base_url: string | null; enabled: boolean; last_test_status: string | null };
type ModelRow = { id: number; name: string; provider_name: string; model_identifier: string; enabled: boolean; priority: number; context_window: number | null; routing_group: string; allowed_tiers: string[] | null; response_timeout_ms: number; restriction_failure_threshold: number; restriction_window_minutes: number; health: { auto_restricted?: boolean; consecutive_failures?: number; restriction_reason?: string | null; last_status?: string | null } | null };
type UserRow = { id: string; email: string; full_name: string | null; subscription_tier: string | null; is_banned: boolean; balance: number; reserved_balance: number };
type TransactionRow = { id?: string; user_id?: string; event_type: string; amount: number; balance_delta?: number; balance_after: number; actual_cost?: number | null; input_tokens?: number; output_tokens?: number; model_id?: number | null; source?: string; reason?: string | null; created_at: string };

function PageHeader({ title }: { title: string }) {
  return <View style={styles.header}><Link href="/admin" asChild><Pressable><Text style={styles.back}>‹ لوحة المشرف</Text></Pressable></Link><Text style={styles.pageTitle}>{title}</Text></View>;
}
function ErrorText({ children }: { children: string | null }) { return children ? <Text accessibilityRole="alert" style={styles.error}>{children}</Text> : null; }
function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }

export function ProvidersAdminScreen() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedPreset = findPreset(selectedType);

  const load = async () => {
    setLoading(true); setError(null);
    try { setProviders((await adminService.getProviders()) as ProviderRow[]); }
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

  const selectPreset = (preset: ProviderPreset) => {
    setSelectedType(preset.type);
    setName(preset.name);
    setBaseUrl(preset.baseUrl);
    setKey("");
    setError(null);
    setNotice(null);
    setShowAdvanced(Boolean(preset.requiresBaseUrl));
  };

  const save = async () => {
    const preset = selectedPreset;
    if (!preset) { setError("اختر المزود من القائمة أولًا."); return; }
    if (!key.trim()) { setError(`الصق مفتاح ${preset.name}. ${preset.keyHint}.`); return; }
    const url = baseUrl.trim();
    if (!url) { setError("هذا المزود يحتاج رابط HTTPS. اكتبه في الخيارات المتقدمة."); return; }
    try { if (new URL(url).protocol !== "https:") throw new Error(); }
    catch { setError("رابط المزود يجب أن يكون HTTPS صحيحًا."); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await adminService.createProvider({
        name: (name.trim() || preset.name),
        provider_type: preset.type,
        base_url: url,
        description: description.trim(),
        api_key: key.trim(),
      });
      setKey("");
      setNotice(`تم حفظ ${name.trim() || preset.name}. نماذج مكتشفة: ${result.discovered}، مضافة: ${result.created}.${result.warning ? ` تنبيه: ${result.warning}` : ""}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشل حفظ المزود.");
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <PageHeader title="مزودو الخدمة" />
    <Text style={styles.explainer}>اختر المزود ثم الصق مفتاحه فقط. الرابط يُملأ تلقائيًا من قائمة المزودين المدعومة، ولا يُرسل المفتاح إلا إلى وظيفة السيرفر المحمية.</Text>
    <Card>
      <Text style={styles.sectionTitle}>١. اختر المزود</Text>
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

      <Text style={styles.sectionTitle}>٢. الصق مفتاح API</Text>
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
      <ErrorText>{error}</ErrorText>
      {notice && <Text style={styles.success}>{notice}</Text>}
      <PrimaryButton label={busy ? "جارٍ الحفظ ومزامنة النماذج…" : "حفظ ومزامنة النماذج"} onPress={() => void save()} disabled={busy || !selectedPreset || !key.trim()} />

      <Pressable onPress={() => setShowAdvanced((value) => !value)} accessibilityRole="button">
        <Text style={styles.link}>{showAdvanced ? "إخفاء الخيارات المتقدمة" : "خيارات متقدمة (الاسم، الرابط، الوصف)"}</Text>
      </Pressable>
      {showAdvanced ? <>
        <Text style={styles.label}>اسم يظهر في القائمة</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="اسم المزود" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>رابط الخدمة (HTTPS)</Text>
        <TextInput style={styles.input} value={baseUrl} onChangeText={setBaseUrl} placeholder="https://api.example.com/v1" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" />
        <Text style={styles.label}>وصف اختياري</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="ملاحظة داخلية" placeholderTextColor={colors.textMuted} />
      </> : null}
    </Card>
    <View style={styles.sectionRow}><Text style={styles.sectionTitle}>المزودون المسجلون</Text><Pressable onPress={() => void load()}><Text style={styles.link}>تحديث</Text></Pressable></View>
    {loading ? <ActivityIndicator color={colors.primary} /> : providers.length === 0 ? <Text style={styles.detail}>لا يوجد مزود مسجل بعد. اختر مزودًا وأضف مفتاحه ليظهر هنا.</Text> : providers.map((provider) => <Card key={provider.id}><Text style={styles.cardTitle}>{provider.name}</Text><Text style={styles.detail}>{provider.provider_type} · {provider.enabled ? "مفعّل" : "معطّل"} · اختبار: {provider.last_test_status ?? "غير مختبر"}</Text><Text numberOfLines={1} style={styles.detail}>{provider.base_url ?? ""}</Text><PrimaryButton label={busyId === provider.id ? "جارٍ المزامنة…" : "مزامنة النماذج"} onPress={() => void syncProvider(provider)} disabled={busyId !== null} /></Card>)}
  </ScrollView>;
}

export function ModelsAdminScreen() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freeTimeout, setFreeTimeout] = useState("5000");
  const [fallbackTimeout, setFallbackTimeout] = useState("30000");
  const [parallel, setParallel] = useState("10");
  const [paidFallback, setPaidFallback] = useState(true);
  const [autoRestrict, setAutoRestrict] = useState(true);
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const result = await adminService.getModelsOverview();
      setModels(result.models as ModelRow[]);
      const config = result.settings as Record<string, unknown> | null;
      setSettings(config);
      if (config) { setFreeTimeout(String(config.free_race_timeout_ms ?? 5000)); setFallbackTimeout(String(config.paid_fallback_timeout_ms ?? 30000)); setParallel(String(config.max_parallel_free_models ?? 10)); setPaidFallback(config.paid_fallback_enabled === true); setAutoRestrict(config.health_auto_restrict_enabled !== false); }
    } catch { setError("تعذر تحميل النماذج أو إعدادات التوجيه."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
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
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <PageHeader title="النماذج والتوجيه" />
    <ErrorText>{error}</ErrorText>
    {loading ? <ActivityIndicator color={colors.primary} /> : <>
      {settings && <Card><Text style={styles.sectionTitle}>إعدادات ai_router_settings</Text><NumberField label="مهلة سباق النماذج (ms)" value={freeTimeout} onChange={setFreeTimeout} /><NumberField label="مهلة البديل المدفوع (ms)" value={fallbackTimeout} onChange={setFallbackTimeout} /><NumberField label="أقصى نماذج متوازية" value={parallel} onChange={setParallel} /><Toggle label="تفعيل البديل المدفوع" value={paidFallback} onChange={setPaidFallback} /><Toggle label="التقييد التلقائي للصحة" value={autoRestrict} onChange={setAutoRestrict} /><PrimaryButton label={busy ? "جارٍ الحفظ…" : "حفظ الإعدادات"} onPress={() => void saveSettings()} disabled={busy} /></Card>}
      <Text style={styles.sectionTitle}>النماذج المفعلة والمعطلة ({models.length})</Text>
      {models.map((model) => <Card key={model.id}>
        <Text style={styles.cardTitle}>{model.name} · {model.provider_name}</Text>
        <Text style={styles.detail}>{model.model_identifier} · {model.enabled ? `مفعّل (${model.routing_group})` : "معطّل"} · أولوية {model.priority}</Text>
        <Text style={styles.detail}>الحالة: {model.health?.last_status ?? "غير مسجلة"} · إخفاقات متتالية: {model.health?.consecutive_failures ?? 0} · تقييد تلقائي: {model.health?.auto_restricted ? "نعم" : "لا"}</Text>
        {model.health?.restriction_reason ? <Text style={styles.warning}>{model.health.restriction_reason}</Text> : null}
        <View style={styles.rowWrap}>
          {model.health?.auto_restricted ? <PrimaryButton label="مراجعة وإعادة تفعيل" onPress={() => void resetHealth(model)} disabled={busy} /> : model.enabled ? <PrimaryButton label="تعطيل" onPress={() => void disable(model)} disabled={busy} /> : <><PrimaryButton label="تفعيل ضمن سباق مجاني" onPress={() => void assignRoute(model, "free_race")} disabled={busy} /><PrimaryButton label="تفعيل كبديل مدفوع" onPress={() => void assignRoute(model, "paid_fallback")} disabled={busy} /></>}
        </View>
      </Card>)}
    </>}
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

export function CircuitBreakerAdminScreen() {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><PageHeader title="قاطع الدائرة" /><Card><Text style={styles.sectionTitle}>غير مكتمل في تطبيق Flutter الحالي</Text><Text style={styles.detail}>المكوّن الحالي في Flutter يعرض ثلاثة تنبيهات ثابتة مع أزرار بلا تنفيذ. لذلك لم تُنقل بيانات تجريبية ولم تُعرض إجراءات إعادة تفعيل أو حذف غير مدعومة هنا.</Text><Text style={styles.detail}>لرؤية صحة النماذج الفعلية واستخدام إجراء إعادة الضبط المدعوم، افتح شاشة «النماذج والتوجيه».</Text><Link href="/admin/models" asChild><Pressable><Text style={styles.link}>الانتقال إلى النماذج والتوجيه</Text></Pressable></Link></Card></ScrollView>;
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="numeric" /></View>;
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <View style={styles.toggle}><Text style={styles.label}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} /> </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 16, gap: 10 },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  back: { color: colors.accent, fontSize: 13 },
  pageTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: "800", textAlign: "right" },
  explainer: { color: colors.textSecondary, lineHeight: 21, textAlign: "right", marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 16, gap: 8 },
  cardTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 16, textAlign: "right" },
  sectionTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 18, textAlign: "right" },
  detail: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: "right" },
  label: { color: colors.textSecondary, textAlign: "right", flex: 1 },
  input: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, paddingHorizontal: 12, color: colors.textPrimary, textAlign: "auto", marginVertical: 4 },
  field: { marginTop: 5 },
  toggle: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  preset: { borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inputBackground, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8, marginBottom: 8 },
  presetSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  presetText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  presetTextSelected: { color: "#FFFFFF" },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: "right", marginVertical: 6 },
  pill: { borderRadius: 20, borderWidth: 1, borderColor: colors.divider, paddingVertical: 7, paddingHorizontal: 10 },
  pillSelected: { borderColor: colors.primary, backgroundColor: "#312E8166" },
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
  modalBackdrop: { flex: 1, backgroundColor: "#00000099", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 500, backgroundColor: colors.surface, borderRadius: 16, padding: 18, gap: 10 },
  modalClose: { alignItems: "center", padding: 8 },
});
