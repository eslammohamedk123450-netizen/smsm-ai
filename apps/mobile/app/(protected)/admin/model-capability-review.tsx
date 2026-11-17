import { useMemo } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../../src/components/ui/PremiumText";
import { UnifiedModelCapabilitiesAdminCard } from "../../../src/features/admin/UnifiedModelCapabilitiesAdminCard";
import { useSulyTheme } from "../../../src/theme/ThemeProvider";
import type { ThemePalette } from "../../../src/theme/colors";

export default function ModelCapabilityReviewPage() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <Link href="/admin/model-capabilities" asChild><Pressable style={styles.back}><Ionicons name="arrow-forward" size={16} color={colors.primary}/><Text style={styles.backText}>العودة إلى دليل القدرات</Text></Pressable></Link>
    <View><Text style={styles.title}>مراجعة الأدلة والاختبارات</Text><Text style={styles.description}>هذه الشاشة تحفظ أدلة المزود ونتائج الاختبار وسجل المراجعة. اعتماد القدرة لا يفعّل النموذج ولا يغيّر الأسعار أو التوجيه.</Text></View>
    <UnifiedModelCapabilitiesAdminCard />
  </ScrollView>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({ root: { flex: 1, backgroundColor: c.background }, content: { padding: 14, gap: 12, paddingBottom: 36 }, back: { flexDirection: "row-reverse", alignItems: "center", gap: 6, alignSelf: "flex-start", padding: 8 }, backText: { color: c.primary, fontSize: 10, fontWeight: "800" }, title: { color: c.textPrimary, fontSize: 18, fontWeight: "900", textAlign: "right" }, description: { color: c.textMuted, fontSize: 10, lineHeight: 16, textAlign: "right" } });
