import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type ServiceType = "chat" | "image" | "video" | "audio";
type ReviewStatus = "suggested" | "legacy_unreviewed" | "approved" | "rejected";
type TestStatus = "not_tested" | "passed" | "failed";
type AuditRow = { id: number; display_name: string | null; capability_key: string | null; action: string; created_at: string };
type ModelRow = {
  model_id: string; provider_id: number; provider_name?: string | null; service_type: ServiceType; model_identifier: string;
  display_name: string; lifecycle_state: "active" | "candidate" | "archived";
  operational_state?: "active" | "disabled" | "restricted" | "candidate" | "archived" | "unknown";
  legacy_chat_model_id: number | null; legacy_media_model_id: string | null;
  capability_key: string | null; review_status: ReviewStatus | null;
  vendor_claim_status: "unknown" | "supported" | "unsupported" | null;
  vendor_evidence_url: string | null; provider_test_status: TestStatus | null;
  provider_evidence_url: string | null; suly_test_status: TestStatus | null;
  suly_evidence_url: string | null; notes: string | null;
};
const CAPABILITIES: Array<[string, string]> = [
  ["text","إدخال وإخراج النص"],["chat","المحادثة"],["vision","فهم الصور"],["pdf_input","إدخال PDF"],
  ["file_input","إدخال الملفات"],["video_input","إدخال الفيديو"],["audio_input","إدخال الصوت"],
  ["audio_output","إخراج الصوت"],["image_generation","توليد الصور"],["video_generation","توليد الفيديو"],
  ["transcription","تفريغ الصوت"],["function_calling","استدعاء الدوال"],["structured_output","مخرجات منظمة"],
  ["streaming","البث التدريجي"],["web_search","بحث الويب"],["file_search","البحث بالملفات"],
  ["computer_use","استخدام الكمبيوتر"],["code_interpreter","تنفيذ الكود"],["mcp_tools","أدوات MCP"],
  ["gmail","Gmail"],["google_drive","Google Drive"],["github","GitHub"],
];
const CAPABILITY_ALIASES: Record<string,string[]> = { pdf_input: ["pdf"], file_input: ["word"], video_input: ["video"] };
const CAPABILITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  text: "text-outline", chat: "chatbubble-ellipses-outline", vision: "eye-outline",
  pdf_input: "document-text-outline", file_input: "folder-outline", video_input: "videocam-outline",
  audio_input: "mic-outline", audio_output: "volume-high-outline", image_generation: "image-outline",
  video_generation: "film-outline", transcription: "ear-outline", function_calling: "git-branch-outline",
  structured_output: "code-slash-outline", streaming: "radio-outline", web_search: "search-outline",
  file_search: "folder-outline", computer_use: "desktop-outline", code_interpreter: "code-slash-outline",
  mcp_tools: "hardware-chip-outline", gmail: "mail-outline", google_drive: "cloud-outline", github: "logo-github",
};
const VENDOR: Array<[string,string]> = [["unknown","غير معروف"],["supported","مدعوم رسميًا"],["unsupported","غير مدعوم"]];
const TEST: Array<[string,string]> = [["not_tested","لم يُختبر"],["passed","نجح"],["failed","فشل"]];
const OPERATIONAL_LABEL: Record<NonNullable<ModelRow["operational_state"]>, string> = { active: "مفعّل", disabled: "معطّل", restricted: "مقيّد", candidate: "مرشح", archived: "مؤرشف", unknown: "غير معلوم" };
const REVIEW: Record<ReviewStatus,string> = {
  suggested:"اقتراح جديد", legacy_unreviewed:"قديم - يحتاج مراجعة", approved:"معتمد", rejected:"مرفوض",
};
const MEDIA_CAPABILITIES: Record<Exclude<ServiceType,"chat">, string[]> = {
  image:["text","image_generation","vision"],
  video:["text","video_generation","video_input","vision","audio_output"],
  audio:["text","audio_input","audio_output","transcription"],
};

export function UnifiedModelCapabilitiesAdminCard() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows,setRows] = useState<ModelRow[]>([]);
  const [audit,setAudit] = useState<AuditRow[]>([]);
  const [selectedId,setSelectedId] = useState("");
  const [capability,setCapability] = useState("text");
  const [search,setSearch] = useState("");
  const [editorSearch,setEditorSearch] = useState("");
  const [selectedToAdd,setSelectedToAdd] = useState<string[]>([]);
  const [vendor,setVendor] = useState<ModelRow["vendor_claim_status"]>("unknown");
  const [vendorUrl,setVendorUrl] = useState("");
  const [provider,setProvider] = useState<TestStatus>("not_tested");
  const [providerUrl,setProviderUrl] = useState("");
  const [suly,setSuly] = useState<TestStatus>("not_tested");
  const [sulyUrl,setSulyUrl] = useState("");
  const [notes,setNotes] = useState("");
  const [review,setReview] = useState<ReviewStatus>("legacy_unreviewed");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [testing,setTesting] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [notice,setNotice] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [capabilityResult,auditResult,chatModelsResult,mediaModelsResult,providersResult,healthResult] = await Promise.all([
        supabase.rpc("suly_admin_list_unified_model_capabilities"),
        supabase.rpc("suly_admin_list_model_registry_audit"),
        supabase.from("ai_models").select("id,enabled,provider_id,routing_group").limit(1000),
        supabase.from("suly_media_generation_models").select("id,is_active,provider_id").limit(1000),
        supabase.from("ai_providers").select("id,enabled").limit(500),
        supabase.from("ai_model_health").select("model_id,auto_restricted").limit(1000),
      ]);
      if(capabilityResult.error) throw capabilityResult.error;
      if(auditResult.error) throw auditResult.error;
      const providerEnabled = new Map<number,boolean>((providersResult.data ?? []).map((row) => [Number(row.id), row.enabled === true]));
      const chatById = new Map<number,{enabled:boolean;routing_group:string}>((chatModelsResult.data ?? []).map((row) => [Number(row.id), {enabled:row.enabled === true,routing_group:String(row.routing_group ?? "")}]));
      const mediaById = new Map<string,{is_active:boolean}>((mediaModelsResult.data ?? []).map((row) => [String(row.id), {is_active:row.is_active === true}]));
      const restrictedById = new Map<number,boolean>((healthResult.data ?? []).map((row) => [Number(row.model_id), row.auto_restricted === true]));
      const operationalDataAvailable = !providersResult.error;
      const next = ((capabilityResult.data ?? []) as ModelRow[]).map((model) => {
        let operational_state: NonNullable<ModelRow["operational_state"]> = "unknown";
        const providerState = providerEnabled.get(Number(model.provider_id));
        if (model.lifecycle_state === "archived") operational_state = "archived";
        else if (providerState === false) operational_state = "disabled";
        else if (providerState === true && model.legacy_chat_model_id !== null) {
          const legacy = chatById.get(Number(model.legacy_chat_model_id));
          if (chatModelsResult.error || !legacy || healthResult.error) operational_state = "unknown";
          else if (!legacy.enabled || legacy.routing_group === "disabled") operational_state = "disabled";
          else if (restrictedById.get(Number(model.legacy_chat_model_id)) === true) operational_state = "restricted";
          else operational_state = "active";
        } else if (providerState === true && model.legacy_media_model_id) {
          const legacy = mediaById.get(model.legacy_media_model_id);
          if (mediaModelsResult.error || !legacy) operational_state = "unknown";
          else operational_state = legacy.is_active ? "active" : "disabled";
        } else if (model.lifecycle_state === "candidate") operational_state = "candidate";
        else operational_state = operationalDataAvailable ? "unknown" : "unknown";
        return {...model,operational_state};
      });
      setRows(next);
      setAudit((auditResult.data ?? []) as AuditRow[]);
      setSelectedId((current) => current && next.some((r) => r.model_id === current) ? current : (next[0]?.model_id ?? ""));
    } catch(cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل سجل النماذج الموحد.");
    } finally { setLoading(false); }
  },[]);
  useEffect(() => { void load(); },[load]);

  const models = useMemo(() => {
    const seen = new Map<string,ModelRow>();
    for(const row of rows) if(!seen.has(row.model_id)) seen.set(row.model_id,row);
    return [...seen.values()];
  },[rows]);
  const visibleModels = useMemo(() => {
    const q=editorSearch.trim().toLocaleLowerCase();
    return models.filter(m => !q || `${m.display_name} ${m.provider_name ?? ""} ${m.model_identifier} ${m.service_type}`.toLocaleLowerCase().includes(q)).slice(0,60);
  },[models,editorSearch]);
  const selected = models.find(m=>m.model_id===selectedId) ?? null;
  const availableCapabilities = selected && selected.service_type!=="chat"
    ? CAPABILITIES.filter(([key])=>MEDIA_CAPABILITIES[selected.service_type as Exclude<ServiceType,"chat">].includes(key))
    : CAPABILITIES;
  const currentCapabilityKeys = new Set([capability, ...(CAPABILITY_ALIASES[capability] ?? [])]);
  const current = rows.find(r=>r.model_id===selectedId && r.capability_key !== null && currentCapabilityKeys.has(r.capability_key)) ?? null;
  useEffect(() => {
    if(availableCapabilities.length && !availableCapabilities.some(([key])=>key===capability)) {
      setCapability(availableCapabilities[0][0]);
    }
  },[selectedId]);

  useEffect(() => {
    setVendor(current?.vendor_claim_status ?? "unknown");
    setVendorUrl(current?.vendor_evidence_url ?? "");
    setProvider(current?.provider_test_status ?? "not_tested");
    setProviderUrl(current?.provider_evidence_url ?? "");
    setSuly(current?.suly_test_status ?? "not_tested");
    setSulyUrl(current?.suly_evidence_url ?? "");
    setNotes(current?.notes ?? "");
    setReview(current?.review_status ?? "suggested");
    setError(null); setNotice(null);
  },[selectedId,capability,rows]);

  const save = async (nextReview: ReviewStatus = review) => {
    if(!selectedId) return;
    if(suly==="passed" && provider!=="passed") { setError("لا يمكن اعتماد نجاح تكامل SULY قبل نجاح اختبار المزود."); return; }
    if(vendor!=="unknown" && !vendorUrl.trim()) { setError("أضف رابط الوثائق الرسمية أولًا."); return; }
    if(provider!=="not_tested" && !providerUrl.trim()) { setError("أضف رابط دليل اختبار المزود أولًا."); return; }
    if(suly!=="not_tested" && !sulyUrl.trim()) { setError("أضف رابط تقرير اختبار SULY أولًا."); return; }
    const urls=[vendorUrl,providerUrl,sulyUrl];
    if(urls.some(u=>u.trim() && !/^https:\/\//i.test(u.trim()))) { setError("يجب أن تبدأ روابط الأدلة بـ https://"); return; }
    setSaving(true);setError(null);setNotice(null);
    try {
      const {data,error:rpcError}=await supabase.rpc("suly_admin_save_unified_model_capability",{
        p_model_id:selectedId,p_capability_key:capability,p_vendor_claim_status:vendor,
        p_vendor_evidence_url:vendorUrl.trim()||null,p_provider_test_status:provider,
        p_provider_evidence_url:providerUrl.trim()||null,p_suly_test_status:suly,
        p_suly_evidence_url:sulyUrl.trim()||null,p_notes:notes.trim()||null,p_review_status:nextReview,
      });
      if(rpcError) throw rpcError;
      if(data?.success!==true) throw new Error("لم تؤكد قاعدة البيانات حفظ التعديل.");
      setReview(nextReview);
      setNotice(nextReview==="approved"?"تم اعتماد القدرة وتسجيل العملية في سجل المراجعة.":nextReview==="rejected"?"تم رفض القدرة وتسجيل العملية.":"تم حفظ بيانات القدرة.");
      await load();
    } catch(cause) { setError(cause instanceof Error?cause.message:"تعذر حفظ القدرة."); }
    finally { setSaving(false); }
  };

  const linkedModels = useMemo(() => {
    const capabilityKeys = new Set([capability, ...(CAPABILITY_ALIASES[capability] ?? [])]);
    const ids = new Set(rows.filter((row) => row.capability_key !== null && capabilityKeys.has(row.capability_key)).map((row) => row.model_id));
    return models.filter((model) => ids.has(model.model_id));
  }, [models, rows, capability]);

  const addableModels = useMemo(() => {
    const linkedIds = new Set(linkedModels.map((model) => model.model_id));
    const query = search.trim().toLocaleLowerCase();
    if (query.length < 2) return [];
    return models.filter((model) => {
      if (linkedIds.has(model.model_id)) return false;
      if (model.service_type !== "chat") {
        const allowed = MEDIA_CAPABILITIES[model.service_type as Exclude<ServiceType, "chat">] ?? [];
        if (!allowed.includes(capability)) return false;
      }
      return !query || `${model.display_name} ${model.model_identifier} ${model.provider_name ?? ""}`.toLocaleLowerCase().includes(query);
    }).slice(0, 40);
  }, [models, linkedModels, capability, search]);

  const saveCapabilityLink = async (model: ModelRow) => {
    const { data, error: rpcError } = await supabase.rpc("suly_admin_save_unified_model_capability", {
      p_model_id: model.model_id,
      p_capability_key: capability,
      p_vendor_claim_status: "unknown",
      p_vendor_evidence_url: null,
      p_provider_test_status: "not_tested",
      p_provider_evidence_url: null,
      p_suly_test_status: "not_tested",
      p_suly_evidence_url: null,
      p_notes: "أضيف من دليل القدرات؛ يحتاج مراجعة واختبار قبل الاعتماد.",
      p_review_status: "suggested",
    });
    if (rpcError) throw rpcError;
    if (data?.success !== true) throw new Error(`لم تؤكد قاعدة البيانات إضافة ${model.display_name}.`);
  };

  const toggleAddSelection = (modelId: string) => {
    setSelectedToAdd((current) => current.includes(modelId) ? current.filter((id) => id !== modelId) : [...current, modelId]);
  };

  const addSelectedModels = async () => {
    const selectedModels = addableModels.filter((model) => selectedToAdd.includes(model.model_id));
    if (!selectedModels.length) return;
    setSaving(true); setError(null); setNotice(null);
    let added = 0;
    let failure: string | null = null;
    try {
      for (const model of selectedModels) {
        try {
          await saveCapabilityLink(model);
          added += 1;
        } catch (cause) {
          failure = cause instanceof Error ? cause.message : `تعذرت إضافة ${model.display_name}.`;
          break;
        }
      }
      setSelectedToAdd([]);
      await load();
      if (failure) setError(`تمت إضافة ${added} نموذجًا قبل توقف الدفعة: ${failure}`);
      else setNotice(`تمت إضافة ${added} نموذجًا كاقتراحات تحتاج مراجعة واختبار.`);
    } finally {
      setSaving(false);
    }
  };

  const runTextProbe = async () => {
    if(!selected?.legacy_chat_model_id || capability!=="text") return;
    setTesting(true);setError(null);setNotice(null);
    try {
      const result=await adminService.testModel(selected.legacy_chat_model_id);
      await load();
      if(result.status==="success") setNotice(`نجح اختبار النص لدى المزود خلال ${Math.max(0,Math.floor(result.duration_ms))}ms. راجع النتيجة ثم اعتمد القدرة.`);
      else setError(`فشل اختبار النص: ${result.error_code ?? "provider_probe_failed"}`);
    } catch(cause) { setError(cause instanceof Error?cause.message:"تعذر اختبار النموذج."); }
    finally { setTesting(false); }
  };

  return <View style={styles.card}>
    <View style={styles.header}>
      <View style={styles.copy}><Text style={styles.title}>سجل النماذج والقدرات الموحد</Text><Text style={styles.sub}>مصدر مركزي واحد لهوية النموذج وأدلة قدراته، مع مراجعة واعتماد منفصلين عن التفعيل والتوجيه والتسعير.</Text></View>
      <Pressable onPress={()=>void load()}><Text style={styles.action}>تحديث</Text></Pressable>
    </View>
    <View style={styles.metrics}>
      <Text style={styles.metric}>إجمالي النماذج: {models.length}</Text>
      <Text style={styles.metric}>مفعّل: {models.filter((model) => model.operational_state === "active").length}</Text>
      <Text style={styles.metric}>معطّل: {models.filter((model) => model.operational_state === "disabled").length}</Text>
      <Text style={styles.metric}>مقيّد: {models.filter((model) => model.operational_state === "restricted").length}</Text>
      <Text style={styles.metric}>مرشح: {models.filter((model) => model.operational_state === "candidate").length}</Text>
      <Text style={styles.metric}>مؤرشف: {models.filter((model) => model.operational_state === "archived").length}</Text>
      <Text style={styles.metric}>غير معلوم: {models.filter((model) => model.operational_state === "unknown").length}</Text>
      <Text style={styles.metric}>قدرات تحتاج مراجعة: {rows.filter(r=>r.capability_key && (r.review_status==="suggested"||r.review_status==="legacy_unreviewed")).length}</Text>
      <Text style={styles.metric}>المعتمدة: {rows.filter(r=>r.review_status==="approved").length}</Text>
    </View>
    <View style={styles.directoryHeader}>
      <View style={styles.copy}>
        <Text style={styles.label}>مكتبة القدرات</Text>
        <Text style={styles.hint}>اختر أيقونة القدرة لعرض النماذج المرتبطة بها أو إضافة نماذج جديدة.</Text>
      </View>
      <Text style={styles.metric}>{CAPABILITIES.length} قدرة</Text>
    </View>
    <View style={styles.capabilityGrid}>
      {CAPABILITIES.map(([key, label]) => {
        const capabilityKeys = new Set([key, ...(CAPABILITY_ALIASES[key] ?? [])]);
        const count = new Set(rows.filter((row) => row.capability_key !== null && capabilityKeys.has(row.capability_key)).map((row) => row.model_id)).size;
        const active = capability === key;
        return <Pressable key={key} onPress={() => { setCapability(key); setSelectedToAdd([]); setNotice(null); }} style={[styles.capabilityTile, active && styles.capabilityTileActive]}>
          <Ionicons name={CAPABILITY_ICONS[key] ?? "apps-outline"} size={20} color={active ? colors.primary : colors.textSecondary}/>
          <Text style={styles.capabilityTileLabel}>{label}</Text>
          <Text style={styles.capabilityCount}>{count} نموذج</Text>
        </Pressable>;
      })}
    </View>
    <View style={styles.directoryHeader}>
      <View style={styles.copy}>
        <Text style={styles.label}>النماذج المرتبطة: {CAPABILITIES.find(([key]) => key === capability)?.[1] ?? capability}</Text>
        <Text style={styles.hint}>الإضافة تنشئ سجلًا مقترحًا فقط؛ لا تفعّل النموذج ولا تمنحه أهلية التوجيه.</Text>
      </View>
      <Text style={styles.metric}>{linkedModels.length}</Text>
    </View>
    {linkedModels.length ? linkedModels.map((model) => {
      const evidence = rows.find((row) => row.model_id === model.model_id && row.capability_key === capability);
      return <Pressable key={model.model_id} onPress={() => setSelectedId(model.model_id)} style={styles.modelListRow}>
        <View style={styles.modelListCopy}>
          <Text style={styles.modelListName}>{model.display_name}</Text>
          <Text style={styles.modelListMeta}>{model.provider_name ?? `المزود #${model.provider_id}`} · {model.service_type} · {model.lifecycle_state === "active" ? "نشط في السجل" : model.lifecycle_state === "archived" ? "مؤرشف" : "مرشح"} · التشغيل: {OPERATIONAL_LABEL[model.operational_state ?? "unknown"]}</Text>
          <Text style={styles.modelListMeta}>المراجعة: {REVIEW[evidence?.review_status ?? "suggested"]} · الاختبار: {evidence?.suly_test_status === "passed" ? "نجح" : evidence?.suly_test_status === "failed" ? "فشل" : "لم يُختبر"}</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={18} color={colors.textMuted}/>
      </Pressable>;
    }) : <Text style={styles.hint}>لا توجد نماذج مرتبطة بهذه القدرة حتى الآن.</Text>}
    <TextInput value={search} onChangeText={setSearch} placeholder="ابحث بحرفين أو أكثر لإضافة نموذج..." placeholderTextColor={colors.textMuted} style={styles.input}/>
    {search.trim().length < 2 ? <Text style={styles.hint}>اكتب حرفين على الأقل لعرض النماذج غير المرتبطة بهذه القدرة.</Text> : addableModels.length ? <>
      <View style={styles.directoryHeader}>
        <Text style={styles.metric}>{addableModels.length} نتيجة · اختر نموذجًا أو أكثر</Text>
        <Pressable disabled={saving || selectedToAdd.length === 0} onPress={() => void addSelectedModels()} style={[styles.addModelButton, (saving || selectedToAdd.length === 0) && styles.disabled]}>
          <Ionicons name="add" size={16} color={colors.onPrimary}/>
          <Text style={styles.addModelText}>إضافة المحدد ({selectedToAdd.length})</Text>
        </Pressable>
      </View>
      {addableModels.map((model) => {
        const chosen = selectedToAdd.includes(model.model_id);
        return <Pressable key={model.model_id} onPress={() => toggleAddSelection(model.model_id)} style={[styles.modelListRow, chosen && styles.capabilityTileActive]}>
          <View style={styles.modelListCopy}>
            <Text style={styles.modelListName}>{model.display_name}</Text>
            <Text style={styles.modelListMeta}>{model.provider_name ?? `المزود #${model.provider_id}`} · {model.model_identifier} · {model.service_type}</Text>
          </View>
          <Ionicons name={chosen ? "checkbox-outline" : "square-outline"} size={20} color={chosen ? colors.primary : colors.textMuted}/>
        </Pressable>;
      })}
      <Pressable disabled={saving || selectedToAdd.length === 0} onPress={() => void addSelectedModels()} style={[styles.addModelButton, (saving || selectedToAdd.length === 0) && styles.disabled]}>
        <Ionicons name="add" size={16} color={colors.onPrimary}/>
        <Text style={styles.addModelText}>إضافة النماذج المحددة</Text>
      </Pressable>
    </> : <Text style={styles.hint}>لا توجد نماذج غير مرتبطة تطابق البحث لهذه القدرة.</Text>}
    <Text style={styles.label}>مراجعة أدلة النموذج</Text>
    <TextInput value={editorSearch} onChangeText={setEditorSearch} placeholder="ابحث عن نموذج لفتح ملف مراجعته..." placeholderTextColor={colors.textMuted} style={styles.input}/>
    <View style={styles.wrap}>{visibleModels.map(m=><Pressable key={m.model_id} onPress={()=>setSelectedId(m.model_id)} style={[styles.chip,selectedId===m.model_id&&styles.selected]}><Text style={styles.chipText}>{m.display_name} · {m.provider_name ?? `مزود #${m.provider_id}`} · {m.service_type}</Text></Pressable>)}</View>
    {models.length>60?<Text style={styles.hint}>يتم عرض أول 60 نتيجة؛ استخدم البحث لتضييق القائمة.</Text>:null}
    {selected?<Text style={styles.selectedName}>{selected.display_name} · {selected.provider_name ?? `المزود #${selected.provider_id}`} · {selected.model_identifier} · {selected.lifecycle_state==="active"?"مفعّل في الكتالوج":selected.lifecycle_state==="archived"?"مؤرشف":"مرشح للمراجعة"} · حالة التشغيل: {OPERATIONAL_LABEL[selected.operational_state ?? "unknown"]}</Text>:null}
    <View style={styles.wrap}>{availableCapabilities.map(([key,label])=><Pressable key={key} onPress={()=>setCapability(key)} style={[styles.chip,capability===key&&styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
    {current?<Text style={styles.review}>حالة المراجعة الحالية: {REVIEW[current.review_status ?? "suggested"]}</Text>:<Text style={styles.hint}>لا يوجد سجل لهذه القدرة بعد. حفظها ينشئ سجلًا جديدًا.</Text>}
    {capability==="text" && selected?.legacy_chat_model_id ? <View style={styles.probeRow}><View style={styles.copy}><Text style={styles.label}>اختبار اتصال النص الفعلي</Text><Text style={styles.hint}>الاختبار لا يعتمد القدرة تلقائيًا ولا يغير إعدادات التوجيه.</Text></View><Pressable disabled={testing||loading} onPress={()=>void runTextProbe()} style={[styles.probe, (testing||loading)&&styles.disabled]}><Text style={styles.saveText}>{testing?"جارٍ الاختبار…":"اختبار النص"}</Text></Pressable></View>:null}
    {loading?<ActivityIndicator color={colors.primary}/>:null}
    <Text style={styles.label}>ادعاء وثائق المزود</Text>
    <View style={styles.wrap}>{VENDOR.map(([v,l])=><Pressable key={v} onPress={()=>setVendor(v as ModelRow["vendor_claim_status"])} style={[styles.chip,vendor===v&&styles.selected]}><Text style={styles.chipText}>{l}</Text></Pressable>)}</View>
    <TextInput value={vendorUrl} onChangeText={setVendorUrl} placeholder="رابط وثائق المزود https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input}/>
    <Text style={styles.label}>اختبار المزود</Text>
    <View style={styles.wrap}>{TEST.map(([v,l])=><Pressable key={v} onPress={()=>setProvider(v as TestStatus)} style={[styles.chip,provider===v&&styles.selected]}><Text style={styles.chipText}>{l}</Text></Pressable>)}</View>
    <TextInput value={providerUrl} onChangeText={setProviderUrl} placeholder="رابط/مرجع دليل الاختبار https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input}/>
    <Text style={styles.label}>اختبار تكامل SULY</Text>
    <View style={styles.wrap}>{TEST.map(([v,l])=><Pressable key={v} onPress={()=>setSuly(v as TestStatus)} style={[styles.chip,suly===v&&styles.selected]}><Text style={styles.chipText}>{l}</Text></Pressable>)}</View>
    <TextInput value={sulyUrl} onChangeText={setSulyUrl} placeholder="رابط تقرير تكامل SULY https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input}/>
    <TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات وقيود الاختبار (اختياري)" placeholderTextColor={colors.textMuted} style={styles.input} multiline/>
    {error?<Text style={styles.error}>{error}</Text>:null}{notice?<Text style={styles.success}>{notice}</Text>:null}
    <View style={styles.actions}>
      <Pressable disabled={saving||loading||!selected} onPress={()=>void save("approved")} style={[styles.approve,(saving||loading||!selected)&&styles.disabled]}><Text style={styles.saveText}>{saving?"جارٍ الحفظ…":"اعتماد القدرة"}</Text></Pressable>
      <Pressable disabled={saving||loading||!selected} onPress={()=>void save("rejected")} style={[styles.reject,(saving||loading||!selected)&&styles.disabled]}><Text style={styles.saveText}>رفض القدرة</Text></Pressable>
      <Pressable disabled={saving||loading||!selected} onPress={()=>void save("legacy_unreviewed")} style={[styles.secondary,(saving||loading||!selected)&&styles.disabled]}><Text style={styles.secondaryText}>حفظ دون اعتماد</Text></Pressable>
    </View>
    <Text style={styles.hint}>الاعتماد يوثق القدرة فقط. لا يفعّل النموذج ولا يغير الأسعار أو رصيد المستخدمين أو تعيينات Brain.</Text>
    <View style={styles.audit}>
      <Text style={styles.label}>سجل التغييرات والمراجعات</Text>
      {audit.length ? audit.slice(0,8).map(item=><View key={item.id} style={styles.auditRow}>
        <Text style={styles.auditTitle}>{item.display_name ?? "نموذج"} · {item.capability_key ?? "—"}</Text>
        <Text style={styles.hint}>{item.action==="capability_approved"?"اعتماد قدرة":item.action==="capability_rejected"?"رفض قدرة":item.action==="route_assignment_added"?"إضافة تعيين مسار":item.action==="route_assignment_removed"?"إزالة تعيين مسار":item.action==="route_assignment_updated"?"تحديث تعيين مسار":"تحديث قدرة"} · {new Date(item.created_at).toLocaleString("ar-EG")}</Text>
      </View>):<Text style={styles.hint}>لا توجد عمليات مراجعة مسجلة بعد.</Text>}
    </View>
  </View>;
}

const createStyles=(c:ThemePalette)=>StyleSheet.create({
  card:{borderWidth:1,borderColor:c.divider,borderRadius:12,backgroundColor:c.surface,padding:13,gap:9},
  directoryHeader:{flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between",gap:8},
  capabilityGrid:{flexDirection:"row-reverse",flexWrap:"wrap",gap:7},
  capabilityTile:{width:"31.5%",minHeight:82,borderWidth:1,borderColor:c.divider,borderRadius:10,backgroundColor:c.background,padding:8,alignItems:"center",justifyContent:"center",gap:5},
  capabilityTileActive:{borderColor:c.primary,backgroundColor:c.primary+"12"},
  capabilityTileLabel:{color:c.textPrimary,fontSize:9,fontWeight:"800",textAlign:"center"},
  capabilityCount:{color:c.textMuted,fontSize:8},
  modelListRow:{flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between",gap:8,borderWidth:1,borderColor:c.divider,borderRadius:9,padding:9,backgroundColor:c.background},
  modelListCopy:{flex:1,gap:3,alignItems:"flex-end"},
  modelListName:{color:c.textPrimary,fontSize:10,fontWeight:"800",textAlign:"right"},
  modelListMeta:{color:c.textMuted,fontSize:8,textAlign:"right"},
  addModelButton:{flexDirection:"row-reverse",alignItems:"center",gap:3,backgroundColor:c.primary,borderRadius:8,paddingHorizontal:9,paddingVertical:7},
  addModelText:{color:c.onPrimary,fontSize:9,fontWeight:"900"},
  header:{flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"flex-start",gap:8},
  copy:{flex:1,alignItems:"flex-end",gap:3},title:{color:c.textPrimary,fontSize:14,fontWeight:"900",textAlign:"right"},
  sub:{color:c.textMuted,fontSize:9,textAlign:"right",lineHeight:15},action:{color:c.primary,fontSize:10,fontWeight:"800"},
  metrics:{flexDirection:"row-reverse",flexWrap:"wrap",gap:8},metric:{color:c.textSecondary,fontSize:9},
  input:{borderWidth:1,borderColor:c.divider,borderRadius:8,padding:9,color:c.textPrimary,fontSize:10,textAlign:"right"},
  wrap:{flexDirection:"row-reverse",flexWrap:"wrap",gap:6},chip:{borderWidth:1,borderColor:c.divider,borderRadius:8,paddingHorizontal:9,paddingVertical:7,backgroundColor:c.background},
  selected:{borderColor:c.primary,backgroundColor:c.primary+"18"},chipText:{color:c.textSecondary,fontSize:9,textAlign:"right"},
  hint:{color:c.textMuted,fontSize:9,textAlign:"right",lineHeight:15},selectedName:{color:c.textPrimary,fontSize:10,textAlign:"right",fontWeight:"800"},
  review:{color:c.primary,fontSize:10,textAlign:"right",fontWeight:"800"},label:{color:c.textPrimary,fontSize:10,fontWeight:"800",textAlign:"right"},
  probeRow:{flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between",gap:8},probe:{backgroundColor:c.primary,borderRadius:8,padding:9},
  audit:{borderTopWidth:1,borderColor:c.divider,paddingTop:10,gap:7},auditRow:{borderWidth:1,borderColor:c.divider,borderRadius:8,padding:8,gap:3},auditTitle:{color:c.textSecondary,fontSize:9,fontWeight:"800",textAlign:"right"},
  actions:{flexDirection:"row-reverse",flexWrap:"wrap",gap:7},approve:{backgroundColor:c.primary,borderRadius:8,padding:10},
  reject:{backgroundColor:c.error,borderRadius:8,padding:10},secondary:{borderWidth:1,borderColor:c.divider,borderRadius:8,padding:10},
  saveText:{color:c.onPrimary,fontSize:9,fontWeight:"900"},secondaryText:{color:c.textSecondary,fontSize:9,fontWeight:"800"},
  disabled:{opacity:0.45},error:{color:c.error,fontSize:10,textAlign:"right"},success:{color:c.success,fontSize:10,textAlign:"right"},
});
