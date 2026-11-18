import { Pressable, ScrollView, View } from "react-native";
import { useAppLocale } from "../../theme/LocaleProvider";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";

export function VideoStudioScreen() {
  const { colors } = useSulyTheme();
  const router = useRouter();
  const { isArabic } = useAppLocale();
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, gap: 14, maxWidth: 900, width: "100%", alignSelf: "center" }}>
    <Text style={{ color: colors.primary, textAlign: isArabic ? "right" : "left", fontSize: 11, fontWeight: "800" }}>SULY CREATIVE</Text>
    <Text style={{ color: colors.textPrimary, textAlign: isArabic ? "right" : "left", fontSize: 25, fontWeight: "900" }}>{isArabic ? "استوديو الفيديو" : "Video Studio"}</Text>
    <Text style={{ color: colors.textSecondary, textAlign: isArabic ? "right" : "left", lineHeight: 22 }}>{isArabic ? "من وصف إلى فيديو، أو من صورة إلى فيديو عندما يدعم النموذج ذلك. ستظهر هنا المدد والجودات المدعومة فقط." : "Turn a prompt into video, or animate an image when a model supports it. Only supported durations and qualities will appear here."}</Text>
    <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, padding: 22, gap: 10 }}>
      <Text style={{ color: colors.textPrimary, textAlign: isArabic ? "right" : "left", fontSize: 17, fontWeight: "800" }}>{isArabic ? "محرك الفيديو قيد التجهيز" : "Video engine is being prepared"}</Text>
      <Text style={{ color: colors.textSecondary, textAlign: isArabic ? "right" : "left", lineHeight: 22 }}>{isArabic ? "لم يتم تفعيل مزود فيديو وبروتوكول تنفيذ وطابور خلفي موثوق حتى الآن. لذلك لن نعرض نموذجًا غير قابل للتنفيذ، ولن نحجز أو نخصم أي Credits قبل اكتمال المحرك واختباره." : "A video provider, execution protocol, and reliable background queue have not been enabled yet. No unavailable model will be shown and no credits will be reserved or charged before the engine is implemented and tested."}</Text>
      <Text style={{ color: colors.textMuted, textAlign: isArabic ? "right" : "left", fontSize: 11 }}>{isArabic ? "سيشمل الإصدار التالي: Text-to-Video، وImage-to-Video عند دعم المزود، واختيار الجودة والمدة، وتقدير السعر، ومتابعة المهمة من المكتبة بعد إغلاق التطبيق." : "The next release is planned to include Text-to-Video, Image-to-Video where supported, quality and duration choices, price estimates, and background job tracking from the Library."}</Text>
      <Pressable onPress={() => router.push("/(protected)/media")} accessibilityRole="button" accessibilityLabel={isArabic ? "فتح مكتبتي" : "Open Library"} style={{ alignSelf: "flex-start", borderWidth: 1, borderColor: colors.divider, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 11 }}>{isArabic ? "فتح مكتبتي" : "Open Library"}</Text>
      </Pressable>
    </View>
  </ScrollView>;
}
