import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { getHimsFeatureStatus, listMyHimsResources, type HimsResource } from "./hims-service";

type Filter = "all" | "lecture" | "video" | "image" | "file";
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "lecture", label: "المحاضرات" },
  { key: "video", label: "الفيديو" },
  { key: "file", label: "الملفات" },
  { key: "image", label: "الصور" },
];
const kindLabel = (kind: string) => ["lecture", "lesson", "course"].includes(kind) ? "محاضرة" : kind === "video" ? "فيديو" : kind === "image" ? "صورة" : "ملف";

export function HimsScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [activated, setActivated] = useState(false);
  const [featureAvailable, setFeatureAvailable] = useState(true);
  const [resources, setResources] = useState<HimsResource[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await getHimsFeatureStatus();
      setFeatureAvailable(Boolean(status));
      setActivated(status?.activated === true);
      if (!status?.activated) {
        setResources([]);
        return;
      }
      setResources(await listMyHimsResources());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل نظام HIMS.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleResources = useMemo(
    () => resources.filter((item) => filter === "all" || item.kind === filter || (filter === "lecture" && ["lesson", "course"].includes(item.kind))),
    [resources, filter],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>SULY EDUCATION</Text>
          <Text style={styles.title}>محتوى HIMS الجامعي</Text>
          <Text style={styles.subtitle}>محاضراتك وملفاتك التعليمية في مكان واحد.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="تحديث المحتوى" onPress={() => void load()} style={styles.refresh}>
          <Ionicons name="refresh" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>جارٍ تحميل المحتوى والتحقق من الصلاحية…</Text></View> : null}

      {!loading && !featureAvailable ? (
        <View style={styles.lockedCard}>
          <Ionicons name="school-outline" size={38} color={colors.primary} />
          <Text style={styles.cardTitle}>النظام غير متاح حاليًا</Text>
          <Text style={styles.muted}>لم يتم تفعيل خدمة HIMS على النظام في الوقت الحالي.</Text>
        </View>
      ) : null}

      {!loading && featureAvailable && !activated ? (
        <View style={styles.lockedCard}>
          <Ionicons name="lock-closed-outline" size={38} color={colors.primary} />
          <Text style={styles.cardTitle}>محتوى الجامعة محمي</Text>
          <Text style={styles.muted}>تحتاج إلى كود التفعيل المخصص لك من الجامعة. أرسل أمر التفعيل الذي استلمته داخل محادثة SULY، ثم ارجع إلى هذه الصفحة.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(protected)/chat")} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>فتح المحادثة للتفعيل</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && activated ? (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}><Ionicons name="book-outline" size={22} color={colors.primary} /></View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>مساحتك التعليمية</Text>
              <Text style={styles.muted}>{resources.length} مورد تعليمي متاح لحسابك</Text>
            </View>
          </View>
          <View style={styles.filters}>
            {FILTERS.map((item) => (
              <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filter, filter === item.key && styles.filterSelected]}>
                <Text style={[styles.filterText, filter === item.key && styles.filterTextSelected]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          {!error && visibleResources.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="documents-outline" size={34} color={colors.textMuted} />
              <Text style={styles.cardTitle}>لا توجد محاضرات مضافة بعد</Text>
              <Text style={styles.muted}>عندما يضيف فريق الجامعة المحاضرات أو الملفات، ستظهر هنا تلقائيًا.</Text>
            </View>
          ) : null}
          <View style={styles.resourceList}>
            {visibleResources.map((item) => (
              <View key={item.id} style={styles.resourceCard}>
                {item.kind === "image" && item.url ? <Image source={{ uri: item.url }} style={styles.preview} resizeMode="cover" /> : (
                  <View style={styles.fileIcon}><Ionicons name={item.kind === "video" ? "videocam-outline" : "document-text-outline"} size={26} color={colors.primary} /></View>
                )}
                <View style={styles.resourceCopy}>
                  <Text style={styles.resourceTitle}>{item.title}</Text>
                  <Text style={styles.muted}>{kindLabel(item.kind)}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString("ar-EG")}` : ""}</Text>
                  {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
                  {!item.url ? <Text style={styles.error}>الملف غير متاح حاليًا. حدّث الصفحة أو تواصل مع إدارة النظام.</Text> : (
                    <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(item.url)} style={styles.openButton}>
                      <Ionicons name="download-outline" size={17} color="#FFFFFF" />
                      <Text style={styles.openButtonText}>فتح / تنزيل</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 980, alignSelf: "center", padding: 18, paddingBottom: 40, gap: 14 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textAlign: "right" },
  title: { color: colors.textPrimary, fontSize: 25, fontWeight: "800", textAlign: "right" },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: "right" },
  refresh: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.divider },
  loading: { padding: 28, alignItems: "center", gap: 10 },
  muted: { color: colors.textSecondary, textAlign: "right", lineHeight: 21, fontSize: 13 },
  error: { color: colors.error, textAlign: "right", lineHeight: 20 },
  lockedCard: { backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 18, padding: 22, alignItems: "center", gap: 12 },
  cardTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "800", textAlign: "center" },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  primaryButtonText: { color: colors.onPrimary, fontWeight: "800" },
  summaryCard: { flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.divider },
  summaryIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1, gap: 3 },
  summaryTitle: { color: colors.textPrimary, fontWeight: "800", textAlign: "right" },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  filter: { borderWidth: 1, borderColor: colors.divider, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  filterSelected: { backgroundColor: colors.surfaceElevated, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  filterTextSelected: { color: colors.primary },
  emptyCard: { padding: 26, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", gap: 10 },
  resourceList: { gap: 12 },
  resourceCard: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  preview: { width: 92, height: 92, borderRadius: 12, backgroundColor: colors.surfaceElevated },
  fileIcon: { width: 92, height: 92, borderRadius: 12, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  resourceCopy: { flex: 1, gap: 7 },
  resourceTitle: { color: colors.textPrimary, fontWeight: "800", fontSize: 15, textAlign: "right" },
  description: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, textAlign: "right" },
  openButton: { flexDirection: "row-reverse", alignSelf: "flex-end", alignItems: "center", gap: 7, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, marginTop: 3 },
  openButtonText: { color: colors.onPrimary, fontSize: 12, fontWeight: "800" },
});
