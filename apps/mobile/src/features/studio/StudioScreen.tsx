import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";
import { supabase } from "../../lib/supabase/client";

type PublicImageModel = {
  id?: string;
  supported_qualities?: string[];
  prices?: Array<{ quality?: string; price_credits?: number }>;
};

function hasVerifiedImageModel(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const model = candidate as PublicImageModel;
    if (typeof model.id !== "string" || !model.id.trim()) return false;
    const supported = new Set(Array.isArray(model.supported_qualities) ? model.supported_qualities : []);
    return Array.isArray(model.prices) && model.prices.some((price) =>
      typeof price?.quality === "string" &&
      supported.has(price.quality) &&
      typeof price.price_credits === "number" &&
      Number.isFinite(price.price_credits) &&
      price.price_credits > 0
    );
  });
}

export function StudioScreen() {
  const router = useRouter();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [imageReady, setImageReady] = useState(false);
  const [checkingImage, setCheckingImage] = useState(true);

  useEffect(() => {
    let active = true;
    const checkImageAvailability = async () => {
      try {
        const { data, error } = await supabase.rpc("suly_list_public_image_models");
        if (active) setImageReady(!error && hasVerifiedImageModel(data));
      } catch {
        if (active) setImageReady(false);
      } finally {
        if (active) setCheckingImage(false);
      }
    };
    void checkImageAvailability();
    return () => { active = false; };
  }, []);

  const services = [
    {
      key: "image",
      title: isArabic ? "توليد الصور" : "Image generation",
      description: checkingImage
        ? (isArabic ? "جارٍ التحقق من النماذج والأسعار المعتمدة…" : "Checking active models and verified prices…")
        : imageReady
          ? (isArabic ? "توجد نماذج صور نشطة بأسعار رصيد معتمدة. يمكنك فتح الاستوديو." : "Active image models with verified credit prices are available.")
          : (isArabic ? "لا يوجد نموذج صور نشط بسعر رصيد معتمد حاليًا. لن يتم حجز أو خصم رصيد." : "No active image model with a verified credit price is available. No credits can be reserved or charged."),
      icon: "image-outline" as const,
      route: "/image-studio",
      ready: imageReady && !checkingImage,
      checking: checkingImage,
    },
    {
      key: "video",
      title: isArabic ? "توليد الفيديو" : "Video generation",
      description: isArabic ? "لا يوجد محرك فيديو متصل ومختبر حاليًا. لن يتم عرض نموذج أو حجز رصيد قبل اعتماد المسار." : "No connected and tested video engine is available. Models and credits remain disabled until the path is verified.",
      icon: "videocam-outline" as const,
      route: "/video-studio",
      ready: false,
      checking: false,
    },
    {
      key: "audio",
      title: isArabic ? "توليد الصوت" : "Audio generation",
      description: isArabic ? "خدمة توليد الصوت لم يتم توصيلها أو اختبارها داخل SULY بعد." : "Audio generation has not yet been connected and tested inside SULY.",
      icon: "musical-notes-outline" as const,
      route: "",
      ready: false,
      checking: false,
    },
    {
      key: "transcription",
      title: isArabic ? "تفريغ الصوت" : "Transcription",
      description: isArabic ? "مسار رفع التسجيل والتفريغ وحفظ النص في المكتبة لم يُختبر بعد." : "The recording upload, transcription, and Library delivery flow has not been verified yet.",
      icon: "document-text-outline" as const,
      route: "",
      ready: false,
      checking: false,
    },
  ];

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>SULY STUDIO</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{isArabic ? "الاستوديو" : "Studio"}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isArabic ? "مساحة مستقلة لإنشاء الصور والفيديو والصوت، وتفريغ التسجيلات إلى نصوص. اختر الخدمة ثم أكّد الطلب داخل الاستوديو." : "A dedicated space for image, video, and audio creation, plus transcription. Choose a service and confirm the request here."}</Text>
      <View style={styles.grid}>
        {services.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ disabled: !item.ready }}
            accessibilityLabel={`${item.title}. ${item.description}`}
            disabled={!item.ready}
            onPress={() => router.push(item.route as never)}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }, !item.ready && styles.disabled]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
              {item.checking
                ? <ActivityIndicator size="small" color={colors.textPrimary} />
                : <Ionicons name={item.icon} size={25} color={colors.textPrimary} />}
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{item.description}</Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.status, { color: item.ready ? colors.textPrimary : colors.textMuted }]}>
                {item.checking
                  ? (isArabic ? "جارٍ التحقق" : "Checking")
                  : item.ready
                    ? (isArabic ? "متاح الآن" : "Available")
                    : (isArabic ? "غير متاح حاليًا" : "Currently unavailable")}
              </Text>
              <Ionicons name={item.ready ? "arrow-back" : "time-outline"} size={16} color={colors.textMuted} />
            </View>
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
