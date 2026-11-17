import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { adminService } from "./admin-service";

type ServiceType = "image" | "video" | "audio";
type MediaModel = { provider_id: number; service_type: ServiceType; model_identifier: string; display_name: string; unit_type: string };
type Evidence = {
  provider_id: number; service_type: ServiceType; model_identifier: string; capability_key: string;
  vendor_claim_status: "unknown" | "supported" | "unsupported"; vendor_evidence_url: string | null;
  provider_test_status: "not_tested" | "passed" | "failed"; provider_evidence_url: string | null;
  suly_test_status: "not_tested" | "passed" | "failed"; suly_evidence_url: string | null; notes: string | null;
};
const OPTIONS: Record<ServiceType, Array<[string,string]>> = {
  image: [["text","إدخال وصف نصي"],["image_generation","توليد الصور"],["vision","فهم/تعديل صورة مرجعية"]],
  video: [["text","إدخال وصف نصي"],["video_generation","توليد الفيديو"],["video_input","فهم/مرجع فيديو"],["vision","استخدام صور مرجعية"],["audio_output","صوت مدمج"]],
  audio: [["text","إدخال نص"],["audio_input","إدخال الصوت"],["audio_output","إخراج الصوت"],["transcription","تفريغ الصوت إلى نص"]],
};
const VENDOR = [["unknown","غير معروف"],["supported","مدعوم رسميًا"],["unsupported","غير مدعوم"]] as const;
const TEST = [["not_tested","لم يُختبر"],["passed","نجح"],["failed","فشل"]] as const;
const keyOf = (m: MediaModel) => `${m.provider_id}:${m.service_type}:${m.model_identifier}`;

export function MediaModelCapabilityEvidenceAdminCard({ serviceType, capabilityKey }: { serviceType?: ServiceType; capabilityKey?: "transcription" | "audio_output" } = {}) {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [models,setModels]=useState<MediaModel[]>([]);
  const [evidence,setEvidence]=useState<Evidence[]>([]);
  const [selectedKey,setSelectedKey]=useState<string>("");
  const [capability,setCapability]=useState(capabilityKey ?? "image_generation");
  const [search,setSearch]=useState("");
  const [vendor,setVendor]=useState<Evidence["vendor_claim_status"]>("unknown");
  const [vendorUrl,setVendorUrl]=useState("");
  const [provider,setProvider]=useState<Evidence["provider_test_status"]>("not_tested");
  const [providerUrl,setProviderUrl]=useState("");
  const [suly,setSuly]=useState<Evidence["suly_test_status"]>("not_tested");
  const [sulyUrl,setSulyUrl]=useState("");
  const [notes,setNotes]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);

  const load=async()=>{
    setLoading(true);setError(null);
    try{
      const [priceRows,evidenceResult]=await Promise.all([
        adminService.getMediaModelPriceVersions(),
        supabase.rpc("suly_admin_list_media_model_capability_evidence"),
      ]);
      if(evidenceResult.error) throw evidenceResult.error;
      const list=((priceRows??[]) as MediaModel[]).filter((model) => !serviceType || model.service_type === serviceType);
      setModels(list);
      setEvidence((evidenceResult.data??[]) as Evidence[]);
      setSelectedKey((current)=>current && list.some((model)=>keyOf(model)===current) ? current : (list[0]?keyOf(list[0]):""));
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذر تحميل أدلة قدرات نماذج الوسائط.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[serviceType]);
  const selected=models.find((m)=>keyOf(m)===selectedKey)??null;
  const capabilities=selected?(capabilityKey?OPTIONS[selected.service_type].filter(([key])=>key===capabilityKey):OPTIONS[selected.service_type]):OPTIONS.image;
  useEffect(()=>{
    if(!capabilities.some(([key])=>key===capability)) setCapability(capabilities[0]?.[0]??"image_generation");
  },[selectedKey]);
  useEffect(()=>{
    const row=evidence.find((e)=>e.provider_id===selected?.provider_id&&e.service_type===selected?.service_type&&e.model_identifier===selected?.model_identifier&&e.capability_key===capability);
    setVendor(row?.vendor_claim_status??"unknown");setVendorUrl(row?.vendor_evidence_url??"");
    setProvider(row?.provider_test_status??"not_tested");setProviderUrl(row?.provider_evidence_url??"");
    setSuly(row?.suly_test_status??"not_tested");setSulyUrl(row?.suly_evidence_url??"");
    setNotes(row?.notes??"");setError(null);setNotice(null);
  },[evidence,selectedKey,capability]);

  const visible=useMemo(()=>{const q=search.trim().toLocaleLowerCase();return models.filter(m=>!q||`${m.display_name} ${m.model_identifier} ${m.service_type}`.toLocaleLowerCase().includes(q));},[models,search]);
  const save=async()=>{
    if(!selected)return;
    const urls=[vendorUrl,providerUrl,sulyUrl];
    if(urls.some(url=>url.trim()&&!/^https:\/\//i.test(url.trim()))){setError("روابط الأدلة يجب أن تبدأ بـ https://");return;}
    if(vendor!=="unknown"&&!vendorUrl.trim()){setError("أضف رابط وثائق المزود قبل اعتماد الادعاء.");return;}
    if(provider!=="not_tested"&&!providerUrl.trim()){setError("أضف دليل اختبار المزود قبل تسجيل النتيجة.");return;}
    if(suly!=="not_tested"&&!sulyUrl.trim()){setError("أضف تقرير اختبار SULY قبل تسجيل النتيجة.");return;}
    if(suly==="passed"&&provider!=="passed"){setError("لا يمكن اعتماد تكامل SULY قبل نجاح اختبار المزود.");return;}
    setSaving(true);setError(null);setNotice(null);
    try{
      const {data,error:rpcError}=await supabase.rpc("suly_admin_save_media_model_capability_evidence",{
        p_provider_id:selected.provider_id,p_service_type:selected.service_type,p_model_identifier:selected.model_identifier,
        p_capability_key:capability,p_vendor_claim_status:vendor,p_vendor_evidence_url:vendorUrl.trim()||null,
        p_provider_test_status:provider,p_provider_evidence_url:providerUrl.trim()||null,
        p_suly_test_status:suly,p_suly_evidence_url:sulyUrl.trim()||null,p_notes:notes.trim()||null,
      });
      if(rpcError)throw rpcError;
      if(data?.success!==true)throw new Error("لم تؤكد قاعدة البيانات حفظ أدلة نموذج الوسائط.");
      setNotice("تم حفظ سجل القدرة مع تدقيق العملية.");
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذر حفظ سجل القدرة.");}
    finally{setSaving(false);}
  };
  return <View style={styles.card}>
    <View style={styles.header}><View style={styles.copy}><Text style={styles.title}>{capabilityKey === "transcription" ? "توثيق نماذج تفريغ الصوت" : capabilityKey === "audio_output" ? "توثيق نماذج توليد الصوت" : "توثيق قدرات الصور والفيديو والصوت"}</Text><Text style={styles.sub}>سجل مستقل عن السعر والتفعيل: وثائق المزود، اختبار المزود، وتكامل SULY.</Text></View><Pressable onPress={()=>void load()}><Text style={styles.action}>تحديث</Text></Pressable></View>
    <TextInput value={search} onChangeText={setSearch} placeholder="ابحث باسم نموذج الوسائط أو معرّفه" placeholderTextColor={colors.textMuted} style={styles.input}/>
    <View style={styles.wrap}>{visible.map(m=><Pressable key={keyOf(m)} onPress={()=>{setSelectedKey(keyOf(m));setCapability(capabilityKey ?? OPTIONS[m.service_type][0][0]);}} style={[styles.chip,selectedKey===keyOf(m)&&styles.selected]}><Text style={styles.chipText}>{m.display_name} · {m.service_type}</Text></Pressable>)}</View>
    {loading?<ActivityIndicator color={colors.primary}/>:null}
    {selected?<Text style={styles.selectedName}>{selected.display_name} · {selected.model_identifier} · Provider #{selected.provider_id}</Text>:null}
    <View style={styles.wrap}>{capabilities.map(([key,label])=><Pressable key={key} onPress={()=>setCapability(key)} style={[styles.chip,capability===key&&styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
    <Text style={styles.label}>١. ادعاء المزود ووثائقه</Text>
    <View style={styles.wrap}>{VENDOR.map(([value,label])=><Pressable key={value} onPress={()=>setVendor(value)} style={[styles.chip,vendor===value&&styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
    <TextInput value={vendorUrl} onChangeText={setVendorUrl} placeholder="رابط الوثائق الرسمية https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input}/>
    <Text style={styles.label}>٢. اختبار المزود</Text>
    <View style={styles.wrap}>{TEST.map(([value,label])=><Pressable key={value} onPress={()=>setProvider(value)} style={[styles.chip,provider===value&&styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
    <TextInput value={providerUrl} onChangeText={setProviderUrl} placeholder="رابط دليل اختبار المزود https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input}/>
    <Text style={styles.label}>٣. تكامل SULY</Text>
    <View style={styles.wrap}>{TEST.map(([value,label])=><Pressable key={value} onPress={()=>setSuly(value)} style={[styles.chip,suly===value&&styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
    <TextInput value={sulyUrl} onChangeText={setSulyUrl} placeholder="رابط تقرير اختبار SULY https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input}/>
    <TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات وقيود (اختياري)" placeholderTextColor={colors.textMuted} style={styles.input} multiline/>
    {error?<Text style={styles.error}>{error}</Text>:null}{notice?<Text style={styles.success}>{notice}</Text>:null}
    <Pressable disabled={saving||loading||!selected} onPress={()=>void save()} style={[styles.save,(saving||loading||!selected)&&styles.disabled]}><Text style={styles.saveText}>{saving?"جارٍ الحفظ…":"حفظ أدلة القدرة"}</Text></Pressable>
    <Text style={styles.hint}>لا يؤدي حفظ الأدلة إلى تشغيل خدمة وسائط أو تغيير سعرها أو خصم رصيد المستخدم.</Text>
  </View>;
}
const createStyles=(c:ThemePalette)=>StyleSheet.create({
 card:{borderWidth:1,borderColor:c.divider,borderRadius:12,backgroundColor:c.surface,padding:13,gap:9},
 header:{flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"flex-start",gap:8},copy:{flex:1,alignItems:"flex-end",gap:3},
 title:{color:c.textPrimary,fontSize:14,fontWeight:"900",textAlign:"right"},sub:{color:c.textMuted,fontSize:9,textAlign:"right",lineHeight:15},
 action:{color:c.primary,fontSize:10,fontWeight:"800"},input:{borderWidth:1,borderColor:c.divider,borderRadius:8,backgroundColor:c.background,color:c.textPrimary,padding:9,fontSize:10,textAlign:"right"},
 wrap:{flexDirection:"row-reverse",flexWrap:"wrap",gap:5},chip:{borderWidth:1,borderColor:c.divider,borderRadius:20,paddingHorizontal:9,paddingVertical:6},
 selected:{borderColor:c.primary,backgroundColor:c.background},chipText:{color:c.textPrimary,fontSize:9},selectedName:{color:c.textPrimary,fontSize:10,fontWeight:"800",textAlign:"right"},
 label:{color:c.textSecondary,fontSize:10,fontWeight:"800",textAlign:"right"},save:{backgroundColor:c.primary,borderRadius:8,padding:10,alignItems:"center"},
 saveText:{color:c.onPrimary,fontSize:10,fontWeight:"800"},disabled:{opacity:0.5},hint:{color:c.textMuted,fontSize:8,textAlign:"right"},
 error:{color:c.error,fontSize:9,textAlign:"right"},success:{color:c.success,fontSize:9,textAlign:"right"},
});
