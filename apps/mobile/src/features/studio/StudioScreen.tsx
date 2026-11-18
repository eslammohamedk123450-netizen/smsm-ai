import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [imageCheckError, setImageCheckError] = useState(false);

  const checkImageAvailability = useCallback(async () => {
    setCheckingImage(true);
    setImageCheckError(false);
    try {
      const { data, error } = await supabase.rpc("suly_list_public_image_models");
      if (error) {
        setImageReady(false);
        setImageCheckError(true);
      } else {
        setImageReady(hasVerifiedImageModel(data));
      }
    } catch {
      setImageReady(false);
      setImageCheckError(true);
    } finally {
      setCheckingImage(false);
    }
  }, []);
  useEffect(() => { void checkImageAvailability(); }, [checkImageAvailability]);

  const services = [
    {
      key: "image",
      title: isArabic ? "توليد الصور" : "Image generation",
      description: checkingImage
        ? (isArabic ? "جارٍ التحقق من النماذج والأسعار المعتمدة…" : "Checking active models and verified prices…")
        : imageCheckError
          ? (isArabic ? "تعذر فحص سجل النماذج الآن. اضغط لإعادة المحاولة." : "Could not check the model registry. Tap to retry.")
          : imageReady
            ? (isArabic ? "توجد نماذج صور نشطة بأسعار رصيد معتمدة. يمكنك فتح الاستوديو." : "Active image models with verified credit prices are available.")
            : (isArabic ? "لا يوجد نموذج صور نشط بسعر رصيد معتمد حاليًا. لن يتم حجز أو خصم رصيد." : "No active image model with a verified credit price is available. No credits can be reserved or charged."),
      icon: "image-outline" as const,
      route: "/image-studio",
      ready: imageReady && !checkingImage,
      checking: checkingImage,
      retry: imageCheckError,
    },
    {
      key: "video",
      title: isArabic ? "توليد الفيديو" : "Video generation",
      description: isArabic ? "لا يوجد محرك فيديو متصل ومختبر حاليًا. لن يتم عرض نموذج أو حجز رصيد قبل اعتماد المسار." : "No connected and tested video engine is available. Models and credits remain disabled until the path is verified.",
      icon: "videocam-outline" as const,
      route: "/video-studio",
      ready: false,
      checking: false,
      retry: false,
    },
    {
      key: "audio",
      title: isArabic ? "توليد الصوت" : "Audio generation",
      description: isArabic ? "خدمة توليد الصوت لم يتم توصيلها أو اختبارها داخل SULY بعد." : "Audio generation has not yet been connected and tested inside SULY.",
      icon: "musical-notes-outline" as const,
      route: "",
      ready: false,
      checking: false,
      retry: false,
    },
    {
      key: "transcription",
      title: isArabic ? "تفريغ الصوت" : "Transcription",
      description: isArabic ? "مسار رفع التسجيل والتفريغ وحفظ النص في المكتبة لم يُختبر بعد." : "The recording upload, transcription, and Library delivery flow has not been verified yet.",
      icon: "document-text-outline" as const,
      route: "",
      ready: false,
      checking: false,
      retry: false,
    },
  ];

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.introCard}>
        <View style={styles.introTop}>
          <View style={styles.introIcon}><Ionicons name="sparkles" size={22} color={colors.onPrimary} /></View>
          <Text style={styles.eyebrow}>{isArabic ? "مساحة الإبداع" : "CREATIVE WORKSPACE"}</Text>
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{isArabic ? "استوديو SULY" : "SULY Studio"}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isArabic ? "حوّل أفكارك إلى محتوى. اختر الأداة المناسبة، وراجع تفاصيل الطلب قبل أي تنفيذ أو خصم رصيد." : "Turn ideas into content. Choose a tool and review the request before anything runs or credits are charged."}</Text>
      </View>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{isArabic ? "أدوات الاستوديو" : "Studio tools"}</Text>
        <Text style={styles.sectionMeta}>{isArabic ? "٤ خدمات" : "4 services"}</Text>
      </View>
      <View style={styles.grid}>
        {services.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ disabled: !item.ready && !item.retry }}
            accessibilityLabel={`${item.title}. ${item.description}`}
            disabled={!item.ready && !item.retry}
            onPress={() => item.retry ? void checkImageAvailability() : router.push(item.route as never)}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }, !item.ready && !item.retry && styles.disabled]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
              {item.checking
                ? <ActivityIndicator size="small" color={colors.textPrimary} />
                : <Ionicons name={item.retry ? "refresh-outline" : item.icon} size={25} color={colors.textPrimary} />}
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{item.description}</Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.status, { color: item.ready ? colors.textPrimary : colors.textMuted }]}>
                {item.checking
                  ? (isArabic ? "جارٍ التحقق" : "Checking")
                  : item.retry
                    ? (isArabic ? "إعادة الفحص" : "Retry check")
                    : item.ready
                      ? (isArabic ? "متاح الآن" : "Available")
                      : (isArabic ? "غير متاح حاليًا" : "Currently unavailable")}
              </Text>
              <Ionicons name={item.retry ? "refresh-outline" : item.ready ? "arrow-back" : "time-outline"} size={16} color={colors.textMuted} />
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: 1080, alignSelf: "center", padding: 20, paddingBottom: 40, gap: 14 },
  introCard: { padding: 22, borderRadius: 22, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, gap: 10 },
  introTop: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10, marginBottom: 4 },
  introIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: colors.textMuted, textAlign: isArabic ? "right" : "left" },
  title: { fontSize: 29, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
  subtitle: { fontSize: 14, lineHeight: 23, textAlign: isArabic ? "right" : "left", maxWidth: 700 },
  sectionHeading: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  sectionMeta: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  grid: { flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 12, marginTop: 2 },
  card: { flexBasis: 240, flexGrow: 1, minHeight: 205, borderWidth: 1, borderColor: colors.divider, borderRadius: 18, padding: 18, gap: 11, backgroundColor: colors.surface },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  cardTitle: { fontSize: 16, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
  cardDescription: { fontSize: 12, lineHeight: 20, textAlign: isArabic ? "right" : "left", flex: 1 },
  cardFooter: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, marginTop: 3 },
  status: { fontSize: 11, fontWeight: "800" },
  disabled: { opacity: 0.62 },
});
