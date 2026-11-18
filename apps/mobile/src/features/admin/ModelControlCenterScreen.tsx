import { useMemo } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { AdminMobileBreadcrumb } from "./AdminMobileBreadcrumb";

const HUB_SECTIONS = [
  { href: "/admin", title: "نظرة عامة", description: "حالة النظام والنشاط التشغيلي", icon: "home-outline" as const },
  { href: "/admin/models-catalog", title: "كتالوج النماذج", description: "البطاقات والمعرفات والمزودون والقدرات", icon: "layers-outline" as const },
  { href: "/admin/api-keys", title: "مصادر واكتشاف النماذج", description: "المزودون ومفاتيح API ومصادر النماذج", icon: "key-outline" as const },
  { href: "/admin/model-capabilities", title: "دليل القدرات", description: "تصنيف القدرات والنماذج المرتبطة بها", icon: "grid-outline" as const },
  { href: "/admin/agents", title: "التعيينات والتوجيه", description: "اختيار النماذج والأدوار وسلاسل البدائل", icon: "git-network-outline" as const },
  { href: "/admin/models-operations", title: "الاختبارات والصحة", description: "التحقق التشغيلي وحالة النماذج", icon: "pulse-outline" as const },
  { href: "/admin/pricing", title: "التكلفة والأسعار", description: "الأسعار والإصدارات واستحقاقات الباقات", icon: "pricetags-outline" as const },
  { href: "/admin/audit", title: "سجل التغييرات", description: "المراجعات والقرارات وسجل التدقيق", icon: "time-outline" as const },
] as const;

export function ModelControlCenterScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <AdminMobileBreadcrumb />
    <View style={styles.header}>
      <Text style={styles.eyebrow}>SULY · MODEL CONTROL CENTER</Text>
      <Text style={styles.title}>مركز النماذج والقدرات</Text>
      <Text style={styles.subtitle}>مركز موحد لإدارة سجل النماذج والقدرات والأدلة والتوجيه والتكلفة والاختبارات. كل الأقسام تستخدم السجلات الحالية نفسها دون إنشاء كتالوج موازٍ.</Text>
    </View>
    <View style={styles.notice}>
      <Ionicons name="shield-checkmark-outline" size={17} color={colors.primary}/>
      <Text style={styles.noticeText}>اعتماد القدرة منفصل عن تفعيل النموذج أو تغيير التوجيه أو الأسعار. الاقتراحات والقدرات القديمة تظل قيد المراجعة حتى اعتمادها.</Text>
    </View>
    <View style={styles.grid}>
      {HUB_SECTIONS.map((section) => <Link key={section.href} href={section.href as never} asChild>
        <Pressable style={styles.tile}>
          <View style={styles.tileIcon}><Ionicons name={section.icon} size={23} color={colors.primary}/></View>
          <View style={styles.tileCopy}><Text style={styles.tileTitle}>{section.title}</Text><Text style={styles.tileDescription}>{section.description}</Text></View>
          <Ionicons name="chevron-back-outline" size={17} color={colors.textMuted}/>
        </Pressable>
      </Link>)}
    </View>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>مراجعة متقدمة</Text>
      <View style={styles.links}>
        <Link href="/admin/model-capability-review" asChild><Pressable style={styles.link}><Ionicons name="clipboard-outline" size={15} color={colors.primary}/><Text style={styles.linkText}>أدلة القدرات واعتمادها</Text></Pressable></Link>
        <Link href="/admin/media-catalog" asChild><Pressable style={styles.link}><Ionicons name="images-outline" size={15} color={colors.primary}/><Text style={styles.linkText}>نماذج الصور والفيديو والصوت</Text></Pressable></Link>
      </View>
    </View>
  </ScrollView>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: 15, gap: 12, paddingBottom: 38 },
  header: { gap: 5, alignItems: "flex-end", paddingVertical: 8 },
  eyebrow: { color: c.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: c.textPrimary, fontSize: 22, fontWeight: "900", textAlign: "right" },
  subtitle: { color: c.textMuted, fontSize: 10, lineHeight: 17, textAlign: "right" },
  notice: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.divider, borderRadius: 11, padding: 11, backgroundColor: c.surface },
  noticeText: { color: c.textSecondary, fontSize: 9, lineHeight: 16, textAlign: "right", flex: 1 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  tile: { width: "48%", minHeight: 128, flexDirection: "row-reverse", alignItems: "center", gap: 9, borderWidth: 1, borderColor: c.divider, borderRadius: 13, padding: 11, backgroundColor: c.surface },
  tileIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: c.primary + "14", alignItems: "center", justifyContent: "center" },
  tileCopy: { flex: 1, alignItems: "flex-end", gap: 5 },
  tileTitle: { color: c.textPrimary, fontSize: 11, fontWeight: "900", textAlign: "right" },
  tileDescription: { color: c.textMuted, fontSize: 8, lineHeight: 14, textAlign: "right" },
  section: { borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 12, gap: 9 },
  sectionTitle: { color: c.textPrimary, fontSize: 11, fontWeight: "900", textAlign: "right" },
  links: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  link: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.divider, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: c.surface },
  linkText: { color: c.textSecondary, fontSize: 8, fontWeight: "800" },
});
