import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { colors } from "../../theme/colors";
import { supabase } from "../../lib/supabase/client";

type VideoModel = { id: string; display_name: string; model_identifier: string; protocol: string; capabilities_json: Record<string, unknown> | null };

export function VideoStudioScreen() {
  const [models, setModels] = useState<VideoModel[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase.from("suly_media_generation_models")
          .select("id,display_name,model_identifier,protocol,capabilities_json")
          .eq("service_type", "video").eq("is_active", true);
        if (active) setModels((data ?? []) as VideoModel[]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, gap: 14, maxWidth: 900, width: "100%", alignSelf: "center" }}>
    <Text style={{ color: colors.primary, textAlign: "right", fontSize: 11, fontWeight: "800" }}>SULY CREATIVE</Text>
    <Text style={{ color: colors.textPrimary, textAlign: "right", fontSize: 25, fontWeight: "900" }}>استوديو الفيديو</Text>
    <Text style={{ color: colors.textSecondary, textAlign: "right", lineHeight: 22 }}>من وصف إلى فيديو، أو من صورة إلى فيديو عند دعم النموذج لذلك. لا نعرض خيارات أو مددًا لا يدعمها المزود.</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : models.length ? <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, padding: 14, gap: 8 }}>
      <Text style={{ color: colors.textPrimary, textAlign: "right", fontWeight: "800" }}>نماذج فيديو مرتبطة</Text>
      {models.map((model) => <View key={model.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: 8 }}>
        <Text style={{ color: colors.textPrimary, textAlign: "right", fontWeight: "700" }}>{model.display_name}</Text>
        <Text style={{ color: colors.textMuted, textAlign: "right", fontSize: 10 }}>{model.model_identifier} · {model.protocol}</Text>
      </View>)}
      <Text style={{ color: colors.warning, textAlign: "right", fontSize: 11 }}>تم تسجيل النماذج، لكن محرك تنفيذ الفيديو والطابور الخلفي لم يُفعّلا بعد. لن نبدأ طلبًا أو نحجز رصيدًا قبل اكتمال المحرك واختباره.</Text>
    </View> : <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, padding: 22, gap: 10 }}>
      <Text style={{ color: colors.textPrimary, textAlign: "right", fontSize: 17, fontWeight: "800" }}>استوديو الفيديو قيد التجهيز</Text>
      <Text style={{ color: colors.textSecondary, textAlign: "right", lineHeight: 22 }}>لم يتم ربط نموذج فيديو خارجي مؤهل بعد. عند توفر نموذج يدعم text-to-video أو image-to-video، سنعرض فقط أوضاع الإدخال والجودة والمدة التي يدعمها فعليًا.</Text>
    </View>}
  </ScrollView>;
}
