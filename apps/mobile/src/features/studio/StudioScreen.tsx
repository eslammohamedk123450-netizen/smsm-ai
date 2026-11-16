import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

export function StudioScreen() {
  const router = useRouter();
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const services = [
    { key: "image", title: "توليد الصور", description: "أنشئ صورًا جديدة أو عدّل صورك.", icon: "image-outline" as const, route: "/image-studio", ready: true },
    { key: "video", title: "توليد الفيديو", description: "حوّل أفكارك إلى مقاطع فيديو.", icon: "videocam-outline" as const, route: "/video-studio", ready: true },
    { key: "audio", title: "توليد الصوت", description: "أنشئ تعليقًا صوتيًا ومقاطع صوتية.", icon: "musical-notes-outline" as const, route: "", ready: false },
    { key: "transcription", title: "تفريغ الصوت", description: "حوّل التسجيلات إلى نص قابل للبحث.", icon: "document-text-outline" as const, route: "", ready: false },
  ];
  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>SULY STUDIO</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>الاستوديو</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>مساحة مستقلة لإنشاء الصور والفيديو والصوت. اختر الخدمة ثم أكّد طلب الإنشاء داخل الاستوديو.</Text>
      <View style={styles.grid}>
        {services.map((item) => (
          <Pressable key={item.key} accessibilityRole="button" disabled={!item.ready} onPress={() => router.push(item.route as never)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }, !item.ready && styles.disabled]}>
            <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}><Ionicons name={item.icon} size={25} color={colors.textPrimary} /></View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{item.description}</Text>
            <View style={styles.cardFooter}><Text style={[styles.status, { color: item.ready ? colors.textPrimary : colors.textMuted }]}>{item.ready ? "متاح الآن" : "قريبًا"}</Text><Ionicons name={item.ready ? "arrow-back" : "time-outline"} size={16} color={colors.textMuted} /></View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
const createStyles = (colors: ThemePalette) => StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: 1040, alignSelf: "center", padding: 20, paddingBottom: 36, gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textAlign: "right" },
  title: { fontSize: 27, fontWeight: "900", textAlign: "right" },
  subtitle: { fontSize: 14, lineHeight: 23, textAlign: "right", maxWidth: 700 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12, marginTop: 12 },
  card: { flexBasis: 220, flexGrow: 1, minHeight: 190, borderWidth: 1, borderRadius: 18, padding: 17, gap: 9 },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "900", textAlign: "right" },
  cardDescription: { fontSize: 12, lineHeight: 19, textAlign: "right", flex: 1 },
  cardFooter: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  status: { fontSize: 11, fontWeight: "800" },
  disabled: { opacity: 0.52 },
});
