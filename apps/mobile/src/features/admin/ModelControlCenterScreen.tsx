import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { adminService } from "./admin-service";
import { ModelCapabilityEvidenceAdminCard } from "./ModelCapabilityEvidenceAdminCard";
import { MediaModelCapabilityEvidenceAdminCard } from "./MediaModelCapabilityEvidenceAdminCard";
import { MediaModelPricingAdminCard } from "./MediaModelPricingAdminCard";
import { RouteModelChainsCard } from "./RouteModelChainsCard";

type ModelRow = {
  id: number; name: string; model_identifier: string; provider_name: string;
  enabled: boolean; provider_enabled?: boolean; routing_group: string;
  task_roles?: string[] | null; capabilities_json?: string | Record<string, unknown> | null;
  health?: { auto_restricted?: boolean } | null;
};

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.section}>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.description}>{description}</Text></View>
    {children}
  </View>;
}

export function ModelControlCenterScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [overview, media] = await Promise.all([
        adminService.getModelsOverview(),
        adminService.getMediaModelPriceVersions(),
      ]);
      setModels((overview.models ?? []) as ModelRow[]);
      setMediaCount((media ?? []).length);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل مركز إدارة النماذج.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeCount = models.filter((model) => model.enabled && model.provider_enabled === true && model.routing_group !== "disabled" && !model.health?.auto_restricted).length;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <Text style={styles.eyebrow}>SULY · ADMIN CONTROL</Text>
      <Text style={styles.title}>مركز إدارة النماذج</Text>
      <Text style={styles.subtitle}>إدارة مركزية للنماذج والقدرات والتعيينات والاختبارات، مع الحفاظ على إعدادات التسعير والتشغيل الحالية.</Text>
    </View>

    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>إعادة المحاولة</Text></Pressable></View> : null}
    {loading ? <ActivityIndicator color={colors.primary} /> : <View style={styles.metrics}>
      <View style={styles.metric}><Text style={styles.metricValue}>{models.length}</Text><Text style={styles.metricLabel}>نماذج المحادثة المسجلة</Text></View>
      <View style={styles.metric}><Text style={styles.metricValue}>{mediaCount}</Text><Text style={styles.metricLabel}>سجلات خدمات الوسائط</Text></View>
      <View style={styles.metric}><Text style={styles.metricValue}>{activeCount}</Text><Text style={styles.metricLabel}>نماذج مؤهلة حاليًا للتوجيه</Text></View>
    </View>}

    <View style={styles.quickLinks}>
      <Link href="/admin/api-keys" asChild><Pressable style={styles.quickLink}><Text style={styles.quickLinkText}>مزودو الخدمة ومفاتيح API</Text></Pressable></Link>
      <Link href="/admin/media-catalog" asChild><Pressable style={styles.quickLink}><Text style={styles.quickLinkText}>كتالوج خدمات الوسائط</Text></Pressable></Link>
      <Link href="/admin/image-generation" asChild><Pressable style={styles.quickLink}><Text style={styles.quickLinkText}>إعدادات تشغيل الصور</Text></Pressable></Link>
    </View>

    <Section title="كتالوج النماذج النصية" description="إدارة النماذج المسجلة وحالتها التشغيلية واختبار اتصال المزود.">
      <View style={styles.note}><Text style={styles.noteText}>المصدر الحالي: ai_models. النماذج المكتشفة حديثًا تظل معطلة حتى مراجعة قدراتها وتعيينها صراحةً.</Text></View>
      <Link href="/admin/models-catalog" asChild><Pressable style={styles.action}><Text style={styles.actionText}>فتح إدارة النماذج النصية</Text></Pressable></Link>
    </Section>

    <Section title="مراجعة قدرات نماذج المحادثة" description="توثيق المزود، اختبار المزود، والتحقق من تكامل SULY.">
      {!loading ? <ModelCapabilityEvidenceAdminCard models={models} /> : null}
    </Section>

    <Section title="مراجعة قدرات الصور والفيديو والصوت" description="أدلة قدرات الوسائط منفصلة عن التسعير والتفعيل؛ لا يؤدي توثيق القدرة إلى تشغيلها.">
      <MediaModelCapabilityEvidenceAdminCard />
    </Section>

    <Section title="تعيينات Brain وسلاسل النماذج" description="تحديد ترتيب النماذج لوظائف الدردشة والتخطيط والتنفيذ والمراجعة والتلخيص.">
      {!loading ? <RouteModelChainsCard models={models} /> : null}
    </Section>

    <Section title="تسعير خدمات الوسائط" description="إعدادات التكلفة وسعر البيع محفوظة كما هي، ولا تتغير بسبب توحيد واجهة الإدارة.">
      <MediaModelPricingAdminCard />
    </Section>

    <View style={styles.footer}><Text style={styles.footerText}>واجهة مركزية واحدة فوق الخدمات الحالية. لن تُحذف الجداول القديمة أو تتغير الأسعار والتعيينات تلقائيًا قبل اكتمال ترحيل آمن واختبار كل مسار استخدام.</Text></View>
  </ScrollView>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: 14, gap: 14, paddingBottom: 40 },
  header: { gap: 5, alignItems: "flex-end", paddingVertical: 8 },
  eyebrow: { color: c.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: c.textPrimary, fontSize: 22, fontWeight: "900", textAlign: "right" },
  subtitle: { color: c.textMuted, fontSize: 11, lineHeight: 18, textAlign: "right" },
  metrics: { flexDirection: "row-reverse", gap: 7 },
  metric: { flex: 1, borderWidth: 1, borderColor: c.divider, borderRadius: 11, padding: 10, backgroundColor: c.surface, alignItems: "center", gap: 4 },
  metricValue: { color: c.primary, fontSize: 20, fontWeight: "900" },
  metricLabel: { color: c.textMuted, fontSize: 8, textAlign: "center" },
  quickLinks: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  quickLink: { borderWidth: 1, borderColor: c.divider, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: c.surface },
  quickLinkText: { color: c.textSecondary, fontSize: 9, fontWeight: "800" },
  section: { gap: 9 },
  sectionHeading: { alignItems: "flex-end", gap: 3 },
  sectionTitle: { color: c.textPrimary, fontSize: 14, fontWeight: "900", textAlign: "right" },
  description: { color: c.textMuted, fontSize: 9, textAlign: "right", lineHeight: 15 },
  note: { borderWidth: 1, borderColor: c.divider, borderRadius: 9, padding: 10, backgroundColor: c.surface },
  noteText: { color: c.textMuted, fontSize: 9, textAlign: "right", lineHeight: 15 },
  action: { borderRadius: 9, backgroundColor: c.primary, padding: 11, alignItems: "center" },
  actionText: { color: c.onPrimary, fontSize: 10, fontWeight: "900" },
  errorBox: { borderWidth: 1, borderColor: c.error, borderRadius: 9, padding: 10, gap: 6 },
  error: { color: c.error, textAlign: "right", fontSize: 10 },
  retry: { color: c.primary, textAlign: "right", fontSize: 10, fontWeight: "800" },
  footer: { borderTopWidth: 1, borderColor: c.divider, paddingTop: 12 },
  footerText: { color: c.textMuted, fontSize: 9, lineHeight: 15, textAlign: "right" },
});
