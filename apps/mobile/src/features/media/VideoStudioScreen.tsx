import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";

export function VideoStudioScreen() {
  const { colors } = useSulyTheme();
  const router = useRouter();
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, gap: 14, maxWidth: 900, width: "100%", alignSelf: "center" }}>
    <Text style={{ color: colors.primary, textAlign: "right", fontSize: 11, fontWeight: "800" }}>SULY CREATIVE</Text>
    <Text style={{ color: colors.textPrimary, textAlign: "right", fontSize: 25, fontWeight: "900" }}>استوديو الفيديو</Text>
    <Text style={{ color: colors.textSecondary, textAlign: "right", lineHeight: 22 }}>من وصف إلى فيديو، أو من صورة إلى فيديو عندما يدعم النموذج ذلك. ستظهر هنا المدد والجودات المدعومة فقط.</Text>
    <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, padding: 22, gap: 10 }}>
      <Text style={{ color: colors.textPrimary, textAlign: "right", fontSize: 17, fontWeight: "800" }}>محرك الفيديو قيد التجهيز</Text>
      <Text style={{ color: colors.textSecondary, textAlign: "right", lineHeight: 22 }}>لم يتم تفعيل مزود فيديو وبروتوكول تنفيذ وطابور خلفي موثوق حتى الآن. لذلك لن نعرض نموذجًا غير قابل للتنفيذ، ولن نحجز أو نخصم أي Credits قبل اكتمال المحرك واختباره.</Text>
      <Text style={{ color: colors.textMuted, textAlign: "right", fontSize: 11 }}>سيشمل الإصدار التالي: Text-to-Video، وImage-to-Video عند دعم المزود، واختيار الجودة والمدة، وتقدير السعر، ومتابعة المهمة من المكتبة بعد إغلاق التطبيق.</Text>
      <Pressable onPress={() => router.push("/(protected)/media")} style={{ alignSelf: "flex-start", borderWidth: 1, borderColor: colors.divider, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 11 }}>فتح مكتبتي</Text>
      </Pressable>
    </View>
  </ScrollView>;
}
