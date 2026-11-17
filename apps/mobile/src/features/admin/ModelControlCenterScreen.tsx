import { useMemo } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

function HubTile({ href, title, description, icon }: { href: string; title: string; description: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Link href={href as never} asChild>
    <Pressable style={styles.tile}>
      <View style={styles.tileIcon}><Ionicons name={icon} size={25} color={colors.primary}/></View>
      <View style={styles.tileCopy}><Text style={styles.tileTitle}>{title}</Text><Text style={styles.tileDescription}>{description}</Text></View>
      <Ionicons name="chevron-back-outline" size={18} color={colors.textMuted}/>
    </Pressable>
  </Link>;
}

export function ModelControlCenterScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>SULY · ADMIN CONTROL</Text>
      <Text style={styles.title}>إدارة النماذج والقدرات</Text>
      <Text style={styles.subtitle}>اختر القسم المطلوب. كتالوج النماذج منفصل عن دليل القدرات، والربط بينهما لا يغير التفعيل أو الأسعار أو مسارات التوجيه.</Text>
    </View>
    <View style={styles.grid}>
      <HubTile href="/admin/models-catalog" title="نماذج التطبيق" description="كل النماذج: المتوفر، المقيّد، المعطّل، مع البحث باسم النموذج والمفتاح." icon="layers-outline"/>
      <HubTile href="/admin/model-capabilities" title="قدرات النماذج" description="افتح القدرات كأيقونات مستقلة، واعرض النماذج المرتبطة بكل قدرة." icon="grid-outline"/>
    </View>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>أدوات الإدارة المتقدمة</Text>
      <View style={styles.links}>
        <Link href="/admin/models-operations" asChild><Pressable style={styles.link}><Ionicons name="pulse-outline" size={15} color={colors.primary}/><Text style={styles.linkText}>التشغيل والاختبارات وسجل الصحة</Text></Pressable></Link>
        <Link href="/admin/api-keys" asChild><Pressable style={styles.link}><Ionicons name="key-outline" size={15} color={colors.primary}/><Text style={styles.linkText}>مزودو الخدمة وأسماء المفاتيح</Text></Pressable></Link>
        <Link href="/admin/media-catalog" asChild><Pressable style={styles.link}><Ionicons name="images-outline" size={15} color={colors.primary}/><Text style={styles.linkText}>إعدادات نماذج الصور والفيديو والصوت</Text></Pressable></Link>
        <Link href="/admin/model-capability-review" asChild><Pressable style={styles.link}><Ionicons name="clipboard-outline" size={15} color={colors.primary}/><Text style={styles.linkText}>مراجعة أدلة القدرات واعتمادها</Text></Pressable></Link>
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
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  tile: { width: "48%", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: c.divider, borderRadius: 14, padding: 12, backgroundColor: c.surface, minHeight: 154 },
  tileIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: c.primary + "14", alignItems: "center", justifyContent: "center" },
  tileCopy: { width: "100%", alignItems: "center", gap: 5 },
  tileTitle: { color: c.textPrimary, fontSize: 12, fontWeight: "900", textAlign: "center" },
  tileDescription: { color: c.textMuted, fontSize: 8, lineHeight: 14, textAlign: "center" },
  section: { borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 12, gap: 9 },
  sectionTitle: { color: c.textPrimary, fontSize: 11, fontWeight: "900", textAlign: "right" },
  links: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  link: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.divider, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: c.surface },
  linkText: { color: c.textSecondary, fontSize: 8, fontWeight: "800" },
});
