import { useMemo } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useAppLocale } from "../../theme/LocaleProvider";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

const SECTIONS = [
  { prefix: "/admin/models-operations", ar: "القدرات والاختبارات", en: "Capabilities & Tests" },
  { prefix: "/admin/model-capabilities", ar: "القدرات والاختبارات", en: "Capabilities & Tests" },
  { prefix: "/admin/model-capability", ar: "القدرات والاختبارات", en: "Capabilities & Tests" },
  { prefix: "/admin/api-keys", ar: "المزودون والنماذج", en: "Providers & Models" },
  { prefix: "/admin/models-catalog", ar: "المزودون والنماذج", en: "Providers & Models" },
  { prefix: "/admin/media-catalog", ar: "المزودون والنماذج", en: "Providers & Models" },
  { prefix: "/admin/image-generation", ar: "المزودون والنماذج", en: "Providers & Models" },
  { prefix: "/admin/models", ar: "المزودون والنماذج", en: "Providers & Models" },
  { prefix: "/admin/agents", ar: "التوجيه والوكيل المركزي", en: "Routing & Agent" },
  { prefix: "/admin/pricing", ar: "الأسعار والباقات", en: "Pricing & Plans" },
  { prefix: "/admin/credit-management", ar: "الأرصدة والمحفظة", en: "Credits & Wallet" },
  { prefix: "/admin/users", ar: "المستخدمون والحسابات", en: "Users & Accounts" },
  { prefix: "/admin/ads", ar: "الإعلانات والمكافآت", en: "Ads & Rewards" },
  { prefix: "/admin/finance", ar: "المالية والربحية", en: "Finance & Profit" },
  { prefix: "/admin/audit", ar: "النشاط وسجل التدقيق", en: "Activity & Audit" },
  { prefix: "/admin/conversations", ar: "النشاط وسجل التدقيق", en: "Activity & Audit" },
  { prefix: "/admin/support", ar: "النشاط وسجل التدقيق", en: "Activity & Audit" },
  { prefix: "/admin/friction", ar: "النشاط وسجل التدقيق", en: "Activity & Audit" },
  { prefix: "/admin/hims", ar: "HIMS والمحتوى", en: "HIMS & Content" },
  { prefix: "/admin/circuit-breaker", ar: "النظام والأمان", en: "System & Security" },
  { prefix: "/admin/storage", ar: "النظام والأمان", en: "System & Security" },
  { prefix: "/admin/composio", ar: "النظام والأمان", en: "System & Security" },
  { prefix: "/admin/tavily", ar: "النظام والأمان", en: "System & Security" },
  { prefix: "/admin/page-builder", ar: "النظام والأمان", en: "System & Security" },
  { prefix: "/admin/custom", ar: "النظام والأمان", en: "System & Security" },
] as const;

export function AdminMobileBreadcrumb() {
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isArabic } = useAppLocale();
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (width >= 900) return null;

  const section = pathname === "/admin"
    ? { ar: "نظرة عامة", en: "Overview" }
    : SECTIONS.find((item) => pathname.startsWith(item.prefix)) ?? { ar: "مساحة الإدارة", en: "Admin workspace" };

  return <View style={[styles.root, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
    <Pressable accessibilityRole="link" accessibilityLabel={isArabic ? "العودة إلى مركز التحكم" : "Return to Control Center"} onPress={() => router.replace("/admin")} style={styles.homeLink}>
      <Text style={styles.homeText}>{isArabic ? "مركز التحكم" : "Control Center"}</Text>
    </Pressable>
    <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={13} color={colors.textMuted} />
    <Text style={styles.sectionText}>{isArabic ? section.ar : section.en}</Text>
  </View>;
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  root: { alignItems: "center", gap: 7, paddingBottom: 2, minHeight: 24 },
  homeLink: { minHeight: 24, justifyContent: "center" },
  homeText: { color: colors.primary, fontSize: 10, fontWeight: "800" },
  sectionText: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
});
