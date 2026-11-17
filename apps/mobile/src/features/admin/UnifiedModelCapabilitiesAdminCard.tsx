import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type ServiceType = "chat" | "image" | "video" | "audio";
type ReviewStatus = "suggested" | "legacy_unreviewed" | "approved" | "rejected";
type TestStatus = "not_tested" | "passed" | "failed";
type ModelRow = {
  model_id: string; provider_id: number; service_type: ServiceType; model_identifier: string;
  display_name: string; lifecycle_state: "active" | "candidate" | "archived";
  legacy_chat_model_id: number | null; legacy_media_model_id: string | null;
  capability_key: string | null; review_status: ReviewStatus | null;
  vendor_claim_status: "unknown" | "supported" | "unsupported" | null;
  vendor_evidence_url: string | null; provider_test_status: TestStatus | null;
  provider_evidence_url: string | null; suly_test_status: TestStatus | null;
  suly_evidence_url: string | null; notes: string | null;
};
const CAPABILITIES: Array<[string, string]> = [
  ["text","إدخال النص"],["chat","المحادثة"],["vision","فهم الصور"],["pdf_input","إدخال PDF"],
  ["file_input","إدخال الملفات"],["video_input","إدخال الفيديو"],["audio_input","إدخال الصوت"],
  ["audio_output","إخراج الصوت"],["image_generation","توليد الصور"],["video_generation","توليد الفيديو"],
  ["transcription","تفريغ الصوت"],["function_calling","استدعاء الدوال"],["structured_output","مخرجات منظمة"],
  ["streaming","البث التدريجي"],["web_search","بحث الويب"],["file_search","البحث بالملفات"],
  ["computer_use","استخدام الكمبيوتر"],["code_interpreter","تنفيذ الكود"],["mcp_tools","أدوات MCP"],
  ["gmail","Gmail"],["google_drive","Google Drive"],["github","GitHub"],
];
const VENDOR: Array<[string,string]> = [["unknown","غير معروف"],["supported","مدعوم رسميًا"],["unsupported","غير مدعوم"]];
const TEST: Array<[string,string]> = [["not_tested","لم يُختبر"],["passed","نجح"],["failed","فشل"]];
const REVIEW: Record<ReviewStatus,string> = {
  suggested:"اقتراح جديد", legacy_unreviewed:"قديم - يحتاج مراجعة", approved:"معتمد", rejected:"مرفوض",
};

export function UnifiedModelCapabilitiesAdminCard() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows,setRows] = useState<ModelRow[]>([]);
  const [selectedId,setSelectedId] = useState("");
  const [capability,setCapability] = useState("text");
  const [search,setSearch] = useState("");
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
      const {data,error:rpcError} = await supabase.rpc("suly_admin_list_unified_model_capabilities");
      if(rpcError) throw rpcError;
      const next = (data ?? []) as ModelRow[];
      setRows(next);
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
    const q=search.trim().toLocaleLowerCase();
    return models.filter(m => !q || `${m.display_name} ${m.model_identifier} ${m.service_type}`.toLocaleLowerCase().includes(q)).slice(0,60);
  },[models,search]);
  const selected = models.find(m=>m.model_id===selectedId) ?? null;
  const current = rows.find(r=>r.model_id===selectedId && r.capability_key===capability) ?? null;

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
      <Text style={styles.metric}>النماذج: {models.length}</Text>
      <Text style={styles.metric}>قدرات تحتاج مراجعة: {rows.filter(r=>r.capability_key && (r.review_status==="suggested"||r.review_status==="legacy_unreviewed")).length}</Text>
      <Text style={styles.metric}>المعتمدة: {rows.filter(r=>r.review_status==="approved").length}</Text>
    </View>
    <TextInput value={search} onChangeText={setSearch} placeholder="ابحث عن نموذج أو معرّف" placeholderTextColor={colors.textMuted} style={styles.input}/>
    <View style={styles.wrap}>{visibleModels.map(m=><Pressable key={m.model_id} onPress={()=>setSelectedId(m.model_id)} style={[styles.chip,selectedId===m.model_id&&styles.selected]}><Text style={styles.chipText}>{m.display_name} · {m.service_type}</Text></Pressable>)}</View>
    {models.length>60?<Text style={styles.hint}>يتم عرض أول 60 نتيجة؛ استخدم البحث لتضييق القائمة.</Text>:null}
    {selected?<Text style={styles.selectedName}>{selected.display_name} · {selected.model_identifier} · المزود #{selected.provider_id} · {selected.lifecycle_state==="active"?"نشط حاليًا":selected.lifecycle_state==="archived"?"مؤرشف":"مرشح للمراجعة"}</Text>:null}
    <View style={styles.wrap}>{CAPABILITIES.map(([key,label])=><Pressable key={key} onPress={()=>setCapability(key)} style={[styles.chip,capability===key&&styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
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
  </View>;
}

const createStyles=(c:ThemePalette)=>StyleSheet.create({
  card:{borderWidth:1,borderColor:c.divider,borderRadius:12,backgroundColor:c.surface,padding:13,gap:9},
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
  actions:{flexDirection:"row-reverse",flexWrap:"wrap",gap:7},approve:{backgroundColor:c.primary,borderRadius:8,padding:10},
  reject:{backgroundColor:c.error,borderRadius:8,padding:10},secondary:{borderWidth:1,borderColor:c.divider,borderRadius:8,padding:10},
  saveText:{color:c.onPrimary,fontSize:9,fontWeight:"900"},secondaryText:{color:c.textSecondary,fontSize:9,fontWeight:"800"},
  disabled:{opacity:0.45},error:{color:c.error,fontSize:10,textAlign:"right"},success:{color:c.success,fontSize:10,textAlign:"right"},
});
