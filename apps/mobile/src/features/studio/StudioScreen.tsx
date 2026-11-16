import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";

export function StudioScreen() {
  const router = useRouter();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const services = [
    { key: "image", title: isArabic ? "توليد الصور" : "Image generation", description: isArabic ? "كتالوج النماذج والأسعار جاهز، لكن التفعيل ينتظر ربط التكلفة بالرصيد واختبار المسار." : "The model catalog and prices are ready; activation awaits credit pricing and integration tests.", icon: "image-outline" as const, route: "/image-studio", ready: false },
    { key: "video", title: isArabic ? "توليد الفيديو" : "Video generation", description: isArabic ? "نماذج الفيديو وأسعارها مسجلة؛ مسار التوليد داخل SULY لم يُتحقق منه بعد." : "Video models and prices are cataloged; the SULY generation path is not verified yet.", icon: "videocam-outline" as const, route: "/video-studio", ready: false },
    { key: "audio", title: isArabic ? "توليد الصوت" : "Audio generation", description: isArabic ? "نماذج الصوت وأسعارها مسجلة، لكن مسار التوليد والخصم داخل SULY لم يُتحقق منه بعد." : "Audio models and prices are cataloged; SULY generation and billing are not verified yet.", icon: "musical-notes-outline" as const, route: "", ready: false },
    { key: "transcription", title: isArabic ? "تفريغ الصوت" : "Transcription", description: isArabic ? "مسار رفع التسجيل والتفريغ وحفظ النص في المكتبة لم يُختبر بعد." : "The recording upload, transcription, and Library delivery flow has not been verified yet.", icon: "document-text-outline" as const, route: "", ready: false },
  ];
  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>SULY STUDIO</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{isArabic ? "الاستوديو" : "Studio"}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isArabic ? "مساحة مستقلة لإنشاء الصور والفيديو والصوت، وتفريغ التسجيلات إلى نصوص. اختر الخدمة ثم أكّد الطلب داخل الاستوديو." : "A dedicated space for image, video, and audio creation, plus transcription. Choose a service and confirm the request here."}</Text>
      <View style={styles.grid}>
        {services.map((item) => (
          <Pressable key={item.key} accessibilityRole="button" disabled={!item.ready} onPress={() => router.push(item.route as never)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }, !item.ready && styles.disabled]}>
            <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}><Ionicons name={item.icon} size={25} color={colors.textPrimary} /></View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{item.description}</Text>
            <View style={styles.cardFooter}><Text style={[styles.status, { color: item.ready ? colors.textPrimary : colors.textMuted }]}>{item.ready ? (isArabic ? "متاح الآن" : "Available") : (isArabic ? "قريبًا" : "Coming soon")}</Text><Ionicons name={item.ready ? "arrow-back" : "time-outline"} size={16} color={colors.textMuted} /></View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: 1040, alignSelf: "center", padding: 20, paddingBottom: 36, gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textAlign: isArabic ? "right" : "left" },
  title: { fontSize: 27, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
  subtitle: { fontSize: 14, lineHeight: 23, textAlign: isArabic ? "right" : "left", maxWidth: 700 },
  grid: { flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  card: { flexBasis: 220, flexGrow: 1, minHeight: 190, borderWidth: 1, borderRadius: 18, padding: 17, gap: 9 },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
  cardDescription: { fontSize: 12, lineHeight: 19, textAlign: isArabic ? "right" : "left", flex: 1 },
  cardFooter: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" },
  status: { fontSize: 11, fontWeight: "800" },
  disabled: { opacity: 0.52 },
});
