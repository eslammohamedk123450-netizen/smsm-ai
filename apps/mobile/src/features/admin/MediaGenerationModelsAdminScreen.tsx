import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";
import { adminService } from "./admin-service";

type Provider = { id: number; name: string; provider_type: string; enabled: boolean };
type MediaModel = {
  id: string; display_name: string; provider_id: number; model_identifier: string; endpoint_url: string;
  allowed_tiers: string[]; supported_qualities: string[]; is_default: boolean; is_active: boolean;
};
type Price = {
  quality: string; price_credits: number; estimated_provider_cost_usd: number; target_margin: number;
  credit_value_egp: number; usd_to_egp: number; resolution: string; enabled: boolean; price_version: number;
};
const QUALITY_OPTIONS = [
  { key: "economy", label: "اقتصادية" },
  { key: "standard", label: "متوسطة" },
  { key: "high", label: "عالية" },
  { key: "ultra", label: "فائقة" },
];
const emptyPrices = (): Price[] => QUALITY_OPTIONS.map((item) => ({
  quality: item.key, price_credits: 10, estimated_provider_cost_usd: 0,
  target_margin: 0.3, credit_value_egp: 0, usd_to_egp: 0, resolution: "1024x1024", enabled: false, price_version: 1,
}));

export function MediaGenerationModelsAdminScreen() {
  const { colors } = useSulyTheme();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<MediaModel[]>([]);
  const [prices, setPrices] = useState<Price[]>(emptyPrices());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [allowedTiers, setAllowedTiers] = useState<string[]>(["free","lite","pro","max"]);
  const [displayName, setDisplayName] = useState("");
  const [modelIdentifier, setModelIdentifier] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [providerRows, modelResult, priceResult] = await Promise.all([
        adminService.getProviders(),
        supabase.from("suly_media_generation_models").select("id,display_name,provider_id,model_identifier,endpoint_url,allowed_tiers,supported_qualities,is_default,is_active").eq("service_type", "image").order("created_at", { ascending: false }),
        supabase.from("suly_media_generation_prices").select("generation_model_id,quality,price_credits,estimated_provider_cost_usd,target_margin,credit_value_egp,usd_to_egp,resolution,enabled").limit(500),
      ]);
      if (modelResult.error || priceResult.error) setError("تعذر تحميل نماذج الصور الخارجية أو الأسعار. تأكد من تطبيق ترحيل مزود الصور وصلاحيات الأدمن.");
      else {
        setProviders((providerRows ?? []) as Provider[]);
        setModels((modelResult.data ?? []) as MediaModel[]);
      }
    } catch {
      setError("تعذر تحميل قائمة مزودي الصور. تأكد من صلاحيات المشرف.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const chooseModel = async (model: MediaModel) => {
    setSelectedId(model.id); setProviderId(model.provider_id); setDisplayName(model.display_name);
    setModelIdentifier(model.model_identifier); setEndpointUrl(model.endpoint_url);
    setIsActive(model.is_active); setIsDefault(model.is_default); setAllowedTiers(model.allowed_tiers ?? []);
    const { data } = await supabase.from("suly_media_generation_prices")
      .select("quality,price_credits,estimated_provider_cost_usd,target_margin,credit_value_egp,usd_to_egp,resolution,enabled,price_version")
      .eq("generation_model_id", model.id);
    const rows = (data ?? []) as Price[];
    setPrices(emptyPrices().map((item) => rows.find((row) => row.quality === item.quality) ?? item));
  };

  const updatePrice = (quality: string, patch: Partial<Price>) => setPrices((current) =>
    current.map((item) => item.quality === quality ? { ...item, ...patch } : item));

  const save = async () => {
    if (!providerId || !providers.some((provider) => provider.id === providerId && provider.enabled)) {
      setError("اختر مزودًا مفعّلًا أولًا."); return;
    }
    if (!displayName.trim() || !modelIdentifier.trim()) { setError("أدخل الاسم الظاهر ومعرّف النموذج لدى المزود."); return; }
    if (allowedTiers.length === 0) { setError("اختر اشتراكًا واحدًا على الأقل لاستخدام النموذج."); return; }
    let endpoint: URL;
    try { endpoint = new URL(endpointUrl.trim()); if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new Error(); }
    catch { setError("أدخل رابط HTTPS صالحًا لنقطة OpenAI Images المتوافقة."); return; }
    const enabledPrices = prices.filter((item) => item.enabled);
    if (enabledPrices.length === 0) {
      setError("فعّل جودة واحدة على الأقل وحدد سعرها بالـ Credits."); return;
    }
    for (const item of enabledPrices) {
      const priceCredits = Number(item.price_credits);
      const estimatedCostUsd = Number(item.estimated_provider_cost_usd);
      const targetMargin = Number(item.target_margin);
      const creditValueEgp = Number(item.credit_value_egp);
      const usdToEgp = Number(item.usd_to_egp);
      if (
        !Number.isSafeInteger(priceCredits) || priceCredits < 1 ||
        !Number.isFinite(estimatedCostUsd) || estimatedCostUsd <= 0 ||
        !Number.isFinite(creditValueEgp) || creditValueEgp <= 0 ||
        !Number.isFinite(usdToEgp) || usdToEgp <= 0 ||
        !Number.isFinite(targetMargin) || targetMargin < 0 || targetMargin >= 1
      ) {
        setError(`أكمل تكلفة المزود بالدولار وقيمة الـ Credit بالجنيه وسعر الصرف والهامش لجودة ${item.quality} قبل تفعيلها.`);
        return;
      }
      const minimumCredits = Math.ceil(
        (estimatedCostUsd * usdToEgp) / ((1 - targetMargin) * creditValueEgp),
      );
      if (!Number.isSafeInteger(minimumCredits) || priceCredits < minimumCredits) {
        setError(`سعر جودة ${item.quality} أقل من التكلفة والهامش؛ الحد الأدنى ${minimumCredits} Credits.`);
        return;
      }
    }
    setSaving(true); setError(null); setNotice(null);
    try {
      const modelPayload = {
        service_type: "image", display_name: displayName.trim(), provider_id: providerId,
        model_identifier: modelIdentifier.trim(), protocol: "openai_images", endpoint_url: endpoint.toString(),
        allowed_tiers: allowedTiers, supported_qualities: prices.filter((item) => item.enabled).map((item) => item.quality),
        capabilities_json: { text_to_image: true, image_to_image: false }, is_default: isDefault,
        is_active: isActive, updated_at: new Date().toISOString(),
      };
      let modelId = selectedId;
      if (selectedId) {
        const { error: updateError } = await supabase.from("suly_media_generation_models").update(modelPayload).eq("id", selectedId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase.from("suly_media_generation_models").insert(modelPayload).select("id").single();
        if (insertError || !data) throw insertError ?? new Error("تعذر إنشاء سجل النموذج.");
        modelId = String(data.id);
        setSelectedId(modelId);
      }
      if (!modelId) throw new Error("معرّف النموذج غير متاح.");
      if (isDefault && isActive) {
        const { error: clearDefaultError } = await supabase.from("suly_media_generation_models")
          .update({ is_default: false }).eq("service_type", "image").neq("id", modelId);
        if (clearDefaultError) throw clearDefaultError;
      }
      const { error: defaultError } = await supabase.from("suly_media_generation_models")
        .update({ is_default: Boolean(isDefault && isActive) }).eq("id", modelId);
      if (defaultError) throw defaultError;
      for (const item of prices) {
        const { error: priceError } = await supabase.from("suly_media_generation_prices").upsert({
          generation_model_id: modelId, quality: item.quality, price_credits: Math.max(1, Math.floor(Number(item.price_credits) || 1)),
          estimated_provider_cost_usd: Math.max(0, Number(item.estimated_provider_cost_usd) || 0),
          target_margin: Math.min(0.95, Math.max(0, Number(item.target_margin) || 0)),
          credit_value_egp: Math.max(0, Number(item.credit_value_egp) || 0),
          usd_to_egp: Math.max(0, Number(item.usd_to_egp) || 0),
          resolution: item.resolution.trim() || "1024x1024", unit_type: "image", enabled: item.enabled,
          price_version: Math.max(1, Number(item.price_version || 1) + (selectedId ? 1 : 0)), updated_at: new Date().toISOString(),
        }, { onConflict: "generation_model_id,quality" });
        if (priceError) throw priceError;
      }
      setNotice("تم حفظ نموذج الصور وأسعار الجودة. سيظهر للمستخدمين عند تفعيل النموذج والسعر.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ إعدادات نموذج الصور.");
    } finally { setSaving(false); }
  };

  const reset = () => {
    setSelectedId(null); setProviderId(null); setDisplayName(""); setModelIdentifier(""); setEndpointUrl("");
    setIsActive(false); setIsDefault(false); setAllowedTiers(["free","lite","pro","max"]); setPrices(emptyPrices()); setError(null); setNotice(null);
  };

  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 13, maxWidth: 950, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled">
    <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
      <Link href="/admin" asChild><Pressable><Text style={{ color: colors.primary }}>‹ لوحة المشرف</Text></Pressable></Link>
      <Text style={{ color: colors.textPrimary, fontSize: 21, fontWeight: "900" }}>نماذج الصور الخارجية</Text>
    </View>
    <Text style={{ color: colors.textSecondary, textAlign: "right", lineHeight: 21 }}>اربط نموذج صور خارجيًا بمزود موجود في ai_providers. لا تُستخدم Cloudflare في هذا المسار. البروتوكول المدعوم حاليًا OpenAI Images المتوافق، ومفتاح المزود يُقرأ من Vault على الخادم فقط.</Text>
    {error ? <Text style={{ color: colors.error, textAlign: "right" }}>{error}</Text> : null}
    {notice ? <Text style={{ color: colors.success, textAlign: "right" }}>{notice}</Text> : null}
    <View style={{ backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 14, padding: 14, gap: 9 }}>
      <Text style={{ color: colors.textPrimary, fontWeight: "800", textAlign: "right" }}>النماذج المسجلة · {models.length}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : models.map((model) => <Pressable key={model.id} onPress={() => void chooseModel(model)} style={{ padding: 10, borderRadius: 9, borderWidth: 1, borderColor: selectedId === model.id ? colors.primary : colors.divider, gap: 3 }}>
        <Text style={{ color: colors.textPrimary, textAlign: "right", fontWeight: "700" }}>{model.display_name} {model.is_default ? "· افتراضي" : ""}</Text>
        <Text style={{ color: colors.textMuted, textAlign: "right", fontSize: 10 }}>{model.model_identifier} · Provider #{model.provider_id} · {model.is_active ? "مفعّل" : "متوقف"}</Text>
      </Pressable>)}
      <Pressable onPress={reset}><Text style={{ color: colors.primary, textAlign: "right", fontWeight: "700" }}>＋ إضافة نموذج صور جديد</Text></Pressable>
    </View>
    <View style={{ backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }}>
      <Text style={{ color: colors.textPrimary, fontWeight: "800", textAlign: "right" }}>{selectedId ? "تعديل النموذج" : "إضافة نموذج جديد"}</Text>
      <Text style={{ color: colors.textSecondary, textAlign: "right" }}>مزود الخدمة</Text>
      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }}>
        {providers.map((provider) => <Pressable key={provider.id} disabled={!provider.enabled} onPress={() => setProviderId(provider.id)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: providerId === provider.id ? colors.primary : colors.divider, opacity: provider.enabled ? 1 : 0.4 }}>
          <Text style={{ color: providerId === provider.id ? colors.primary : colors.textSecondary, fontSize: 11 }}>{provider.name} {provider.enabled ? "" : "(متوقف)"}</Text>
        </Pressable>)}
      </View>
      {[
        ["الاسم الظاهر في SULY", displayName, setDisplayName],
        ["معرّف النموذج لدى المزود", modelIdentifier, setModelIdentifier],
        ["Endpoint HTTPS", endpointUrl, setEndpointUrl],
      ].map(([label, value, setter]) => <View key={String(label)} style={{ gap: 5 }}>
        <Text style={{ color: colors.textSecondary, textAlign: "right", fontSize: 11 }}>{String(label)}</Text>
        <TextInput value={String(value)} onChangeText={setter as (value: string) => void} autoCapitalize="none" placeholderTextColor={colors.textMuted} style={{ color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 9, padding: 10, textAlign: "left" }} />
      </View>)}
      <Text style={{ color: colors.textSecondary, textAlign: "right", fontSize: 11, fontWeight: "700" }}>الاشتراكات التي يمكنها استخدام النموذج</Text>
      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }}>
        {([["free","مجاني"],["lite","Lite"],["pro","Pro"],["max","Max"]] as const).map(([tier,label]) => <Pressable key={tier} onPress={() => setAllowedTiers((current) => current.includes(tier) ? current.filter((item) => item !== tier) : [...current,tier])} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: allowedTiers.includes(tier) ? colors.primary : colors.divider }}>
          <Text style={{ color: allowedTiers.includes(tier) ? colors.primary : colors.textMuted, fontSize: 11 }}>{label}</Text>
        </Pressable>)}
      </View>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: colors.textSecondary }}>تفعيل النموذج للمستخدمين</Text><Switch value={isActive} onValueChange={setIsActive} /></View>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: colors.textSecondary }}>النموذج الافتراضي لاستوديو الصور</Text><Switch value={isDefault} onValueChange={setIsDefault} /></View>
      <Text style={{ color: colors.textPrimary, textAlign: "right", fontWeight: "800" }}>تسعير الجودة والربحية</Text>
      <Text style={{ color: colors.textMuted, textAlign: "right", fontSize: 10 }}>قيمة الـ Credit بالجنيه وسعر الدولار ضروريان لحساب التسوية الفعلية وهامش الربح. Credits هنا مبلغ الحجز التقديري؛ وبعد التنفيذ تُحسب التسوية من التكلفة المؤكدة إن أرجعها المزود، وإلا يُستخدم التقدير المسجل.</Text>
      {prices.map((item) => <View key={item.quality} style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 9, gap: 7 }}>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>{QUALITY_OPTIONS.find((option) => option.key === item.quality)?.label}</Text>
          <Switch value={item.enabled} onValueChange={(value) => updatePrice(item.quality, { enabled: value })} />
        </View>
        <View style={{ flexDirection: "row-reverse", gap: 7 }}>
          {[
            ["الحجز التقديري Credits", "price_credits"],
            ["تكلفة المزود USD", "estimated_provider_cost_usd"],
            ["هامش الربح 0–0.95", "target_margin"],
          ].map(([label, key]) => <View key={key} style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 9, textAlign: "right" }}>{label}</Text>
            <TextInput value={String(item[key as keyof Price] ?? "")} onChangeText={(value) => updatePrice(item.quality, { [key]: Number(value) } as Partial<Price>)} keyboardType="decimal-pad" style={{ color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 8, padding: 8, textAlign: "center" }} />
          </View>)}
        </View>
        <View style={{ flexDirection: "row-reverse", gap: 7 }}>
          {[
            ["قيمة Credit بالجنيه", "credit_value_egp"],
            ["الدولار بالجنيه", "usd_to_egp"],
          ].map(([label, key]) => <View key={key} style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 9, textAlign: "right" }}>{label}</Text>
            <TextInput value={String(item[key as keyof Price] ?? "")} onChangeText={(value) => updatePrice(item.quality, { [key]: Number(value) } as Partial<Price>)} keyboardType="decimal-pad" style={{ color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 8, padding: 8, textAlign: "center" }} />
          </View>)}
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.textMuted, fontSize: 9, textAlign: "right" }}>دقة الصورة</Text>
          <TextInput value={item.resolution} onChangeText={(value) => updatePrice(item.quality, { resolution: value })} style={{ color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 8, padding: 8, textAlign: "center" }} />
        </View>
      </View>)}
      <Pressable disabled={saving} onPress={() => void save()} style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 12, opacity: saving ? 0.5 : 1 }}>
        <Text style={{ color: colors.background, fontWeight: "900", textAlign: "center" }}>{saving ? "جارٍ الحفظ…" : "حفظ نموذج الصور والأسعار"}</Text>
      </Pressable>
    </View>
  </ScrollView>;
}
