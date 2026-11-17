import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { AdminMobileBreadcrumb } from "./AdminMobileBreadcrumb";

type Bucket = Awaited<ReturnType<typeof adminService.getStorageBuckets>>[number];
type StorageObject = Awaited<ReturnType<typeof adminService.listStorageObjects>>[number];

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageSettingsScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [segments, setSegments] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [bucketsAvailable, setBucketsAvailable] = useState(false);
  const [objectsAvailable, setObjectsAvailable] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBuckets = useCallback(async () => {
    setLoadingBuckets(true);
    setBucketsAvailable(false);
    setError(null);
    try {
      const rows = await adminService.getStorageBuckets();
      setBuckets(rows);
      setBucketsAvailable(true);
      setSelectedBucket((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل مساحات التخزين. تحقق من صلاحيات Storage.");
      setBuckets([]);
      setBucketsAvailable(false);
      setSelectedBucket(null);
    } finally {
      setLoadingBuckets(false);
    }
  }, []);

  const loadObjects = useCallback(async (bucketId: string, nextSegments: string[]) => {
    setLoadingObjects(true);
    setObjectsAvailable(false);
    setError(null);
    try {
      const rows = await adminService.listStorageObjects(bucketId, nextSegments.join("/"));
      setObjects(rows);
      setObjectsAvailable(true);
    } catch (cause) {
      setObjects([]);
      setObjectsAvailable(false);
      setError(cause instanceof Error ? cause.message : "تعذر عرض الملفات. قد لا تسمح سياسات Storage باستعراض هذا المسار.");
    } finally {
      setLoadingObjects(false);
    }
  }, []);

  useEffect(() => { void loadBuckets(); }, [loadBuckets]);
  useEffect(() => {
    if (selectedBucket) void loadObjects(selectedBucket, segments);
    else { setObjects([]); setObjectsAvailable(false); }
  }, [selectedBucket, segments, loadObjects]);

  const bucket = buckets.find((item) => item.id === selectedBucket) ?? null;
  const filtered = objects.filter((item) => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const totalKnownBytes = objects.reduce((sum, item) => sum + (item.id !== null ? Number(item.metadata?.size ?? 0) : 0), 0);
  const fileCount = objects.filter((item) => item.id !== null).length;
  const folderCount = objects.length - fileCount;

  const openFolder = (name: string) => { setSearch(""); setSegments((current) => [...current, name]); };
  const goToSegment = (index: number) => { setSearch(""); setSegments((current) => current.slice(0, index + 1)); };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <AdminMobileBreadcrumb />
    <View style={styles.heading}>
      <View style={styles.headingCopy}>
        <Text style={styles.eyebrow}>إدارة البنية والملفات</Text>
        <Text style={styles.title}>التخزين ومساحات الملفات</Text>
        <Text style={styles.subtitle}>استعراض حقيقي لمساحات Supabase والملفات وفق صلاحيات الجلسة الحالية. هذه الصفحة للقراءة فقط ولا تغيّر صلاحيات الوصول أو تحذف ملفات.</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => { void loadBuckets(); if (selectedBucket) void loadObjects(selectedBucket, segments); }} style={styles.refresh}>
        <Text style={styles.refreshText}>{loadingBuckets || loadingObjects ? "جارٍ التحديث…" : "↻ تحديث"}</Text>
      </Pressable>
    </View>

    {error ? <View style={styles.errorPanel}><Text style={styles.errorText}>{error}</Text></View> : null}
    {loadingBuckets ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}

    <View style={styles.summaryRow}>
      <View style={styles.summaryCard}><Text style={styles.summaryLabel}>مساحات التخزين</Text><Text style={styles.summaryValue}>{bucketsAvailable ? buckets.length : "—"}</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryLabel}>ملفات ظاهرة في المسار</Text><Text style={styles.summaryValue}>{objectsAvailable ? fileCount : "—"}</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryLabel}>مجلدات ظاهرة</Text><Text style={styles.summaryValue}>{objectsAvailable ? folderCount : "—"}</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryLabel}>حجم الملفات الظاهرة</Text><Text style={styles.summaryValue}>{objectsAvailable ? formatBytes(totalKnownBytes) : "—"}</Text></View>
    </View>

    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>مساحات التخزين المتاحة</Text>
      {buckets.length ? <View style={styles.bucketList}>{buckets.map((item) => {
        const active = item.id === selectedBucket;
        return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { setSelectedBucket(item.id); setSegments([]); setSearch(""); }} style={[styles.bucketCard, active && styles.bucketActive]}>
          <View style={styles.bucketTop}><Text style={[styles.bucketName, active && styles.activeText]}>{item.name}</Text><Text style={[styles.visibility, item.public ? styles.public : styles.private]}>{item.public ? "عام" : "خاص"}</Text></View>
          <Text style={styles.bucketMeta}>الحد الأقصى للملف: {item.file_size_limit ? formatBytes(item.file_size_limit) : "غير محدد"}</Text>
          <Text style={styles.bucketMeta}>أنواع الملفات: {item.allowed_mime_types?.length ? `${item.allowed_mime_types.length} نوع مسموح` : "غير مقيّدة على مستوى الحاوية"}</Text>
        </Pressable>;
      })}</View> : !loadingBuckets ? <Text style={styles.empty}>لا توجد مساحات ظاهرة، أو أن صلاحية عرض الحاويات غير متاحة لهذه الجلسة.</Text> : null}
    </View>

    <View style={styles.panel}>
      <View style={styles.filesHeading}>
        <View style={styles.headingCopy}><Text style={styles.sectionTitle}>محتويات المساحة</Text><Text style={styles.bucketMeta}>{bucket ? `${bucket.name} · ${bucket.public ? "وصول عام للقراءة" : "وصول خاص محكوم بالسياسات"}` : "اختر مساحة تخزين لعرض محتوياتها"}</Text></View>
        {loadingObjects ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
      {bucket ? <>
        <View style={styles.breadcrumb}>
          <Pressable onPress={() => goToSegment(-1)}><Text style={styles.crumb}>{bucket.name}</Text></Pressable>
          {segments.map((segment, index) => <View key={`${segment}-${index}`} style={styles.crumbPart}><Text style={styles.crumbDivider}>/</Text><Pressable onPress={() => goToSegment(index)}><Text style={styles.crumb}>{segment}</Text></Pressable></View>)}
        </View>
        <TextInput value={search} onChangeText={setSearch} placeholder="ابحث في العناصر الظاهرة بهذا المجلد" placeholderTextColor={colors.textMuted} style={styles.search} autoCapitalize="none" />
        {segments.length ? <Pressable accessibilityRole="button" onPress={() => setSegments((current) => current.slice(0, -1))} style={styles.backFolder}><Text style={styles.backFolderText}>↑ الرجوع للمجلد السابق</Text></Pressable> : null}
        {filtered.length ? filtered.map((item) => {
          const isFolder = item.id === null;
          return <Pressable key={item.name} accessibilityRole={isFolder ? "button" : undefined} disabled={!isFolder} onPress={() => openFolder(item.name)} style={styles.objectRow}>
            <Text style={styles.objectIcon}>{isFolder ? "📁" : "▤"}</Text>
            <View style={styles.objectCopy}><Text style={styles.objectName}>{item.name}</Text><Text style={styles.objectMeta}>{isFolder ? "مجلد" : `${formatBytes(Number(item.metadata?.size ?? 0))} · ${item.metadata?.mimetype ?? "نوع غير محدد"}`}</Text></View>
            <Text style={styles.objectMeta}>{item.updated_at ? new Date(item.updated_at).toLocaleDateString("ar-EG") : ""}</Text>
            {isFolder ? <Text style={styles.openArrow}>‹</Text> : null}
          </Pressable>;
        }) : !loadingObjects ? <Text style={styles.empty}>{search ? "لا توجد عناصر مطابقة للبحث في هذا المجلد." : "هذا المجلد فارغ، أو لا توجد عناصر يمكن عرضها بهذه الصلاحيات."}</Text> : null}
        <Text style={styles.footnote}>يتم عرض أول 100 عنصر في المسار الحالي. الحجم المعروض هو مجموع الملفات الظاهرة فقط، وليس إجمالي استخدام المشروع.</Text>
      </> : <Text style={styles.empty}>اختر مساحة تخزين من الأعلى.</Text>}
    </View>
    <View style={styles.notice}><Text style={styles.noticeTitle}>ضوابط الأمان</Text><Text style={styles.noticeText}>الحاوية الخاصة لا تصبح عامة من هذه الصفحة. لا توجد هنا عمليات حذف أو تغيير سياسات أو إنشاء روابط عامة. تُنفّذ قراءة بيانات التخزين داخل وظيفة خادمية تتحقق أولًا من جلسة المشرف وصلاحيته، ثم تستخدم صلاحية الخدمة على الخادم لعرض بيانات الحاويات والملفات للمشرف فقط. لا يصل مفتاح الخدمة إلى التطبيق أو المتصفح، ولا تتغير سياسات Storage أو صلاحيات المستخدمين.</Text></View>
  </ScrollView>;
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, maxWidth: 1120, width: "100%", alignSelf: "center" },
  heading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headingCopy: { flex: 1, alignItems: "flex-end", gap: 4 },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "800" },
  title: { color: colors.textPrimary, fontSize: 21, fontWeight: "900", textAlign: "right" },
  subtitle: { color: colors.textMuted, fontSize: 10, lineHeight: 18, textAlign: "right" },
  refresh: { borderWidth: 1, borderColor: colors.divider, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: colors.surface },
  refreshText: { color: colors.primary, fontSize: 10, fontWeight: "800" },
  loader: { alignSelf: "flex-end" },
  errorPanel: { padding: 11, borderRadius: 9, borderWidth: 1, borderColor: colors.error, backgroundColor: colors.surface },
  errorText: { color: colors.error, textAlign: "right", fontSize: 11 },
  summaryRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  summaryCard: { flexGrow: 1, flexBasis: 145, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: 12, gap: 5 },
  summaryLabel: { color: colors.textMuted, fontSize: 9, textAlign: "right" },
  summaryValue: { color: colors.textPrimary, fontSize: 19, fontWeight: "900", textAlign: "right" },
  panel: { borderRadius: 11, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: 13, gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "900", textAlign: "right" },
  bucketList: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  bucketCard: { flexGrow: 1, flexBasis: 220, padding: 11, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background, gap: 6 },
  bucketActive: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
  bucketTop: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 },
  bucketName: { color: colors.textPrimary, fontSize: 12, fontWeight: "800" },
  activeText: { color: colors.primary },
  visibility: { fontSize: 9, fontWeight: "800", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden" },
  public: { color: colors.warning, backgroundColor: colors.surfaceElevated },
  private: { color: colors.success, backgroundColor: colors.surfaceElevated },
  bucketMeta: { color: colors.textMuted, fontSize: 9, textAlign: "right" },
  empty: { color: colors.textMuted, fontSize: 11, textAlign: "right", paddingVertical: 12 },
  filesHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  breadcrumb: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", gap: 5 },
  crumbPart: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  crumb: { color: colors.primary, fontSize: 10, fontWeight: "800" },
  crumbDivider: { color: colors.textMuted, fontSize: 10 },
  search: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, backgroundColor: colors.background, color: colors.textPrimary, paddingHorizontal: 11, paddingVertical: 9, fontSize: 11, textAlign: "right" },
  backFolder: { alignSelf: "flex-end", paddingVertical: 5 },
  backFolderText: { color: colors.primary, fontSize: 10, fontWeight: "800" },
  objectRow: { flexDirection: "row-reverse", alignItems: "center", gap: 9, paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: colors.divider },
  objectIcon: { color: colors.primary, fontSize: 17 },
  objectCopy: { flex: 1, minWidth: 0, gap: 3, alignItems: "flex-end" },
  objectName: { color: colors.textPrimary, fontSize: 11, fontWeight: "700", textAlign: "right" },
  objectMeta: { color: colors.textMuted, fontSize: 8, textAlign: "right" },
  openArrow: { color: colors.primary, fontSize: 17 },
  footnote: { color: colors.textMuted, fontSize: 8, lineHeight: 14, textAlign: "right" },
  notice: { padding: 12, borderRadius: 10, backgroundColor: colors.surfaceElevated, gap: 6 },
  noticeTitle: { color: colors.textPrimary, fontSize: 11, fontWeight: "900", textAlign: "right" },
  noticeText: { color: colors.textSecondary, fontSize: 9, lineHeight: 16, textAlign: "right" },
});
