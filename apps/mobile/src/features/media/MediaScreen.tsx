import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useRouter } from "expo-router";
import { chatService } from "../chat/chat-service";
import * as Clipboard from "expo-clipboard";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";
import { deleteMediaAsset, formatBytes, listMyMedia, listMyGenerationJobs, pickMedia, uploadMediaFile, type MediaAsset, type MediaGenerationJob, type PickKind } from "./media-service";

export function MediaScreen() {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [jobs, setJobs] = useState<MediaGenerationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PickKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reuseBusyId, setReuseBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "image" | "video" | "file" | "in_progress">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextAssets, nextJobs] = await Promise.all([listMyMedia(), listMyGenerationJobs()]);
      setAssets(nextAssets);
      setJobs(nextJobs);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحميل المكتبة." : "Could not load the library.")); }
    finally { setLoading(false); }
  }, [isArabic]);
  useEffect(() => {
    void load();
    supabase.rpc("suly_is_admin").then(({ data }) => setIsAdmin(data === true));
  }, [load]);

  const pickAndUpload = async (kind: PickKind) => {
    setBusy(kind); setError(null); setNotice(null);
    try {
      const picked = await pickMedia(kind);
      if (!picked) { setBusy(null); return; }
      setNotice(isArabic ? `جارٍ رفع ${picked.part.name}…` : `Uploading ${picked.part.name}…`);
      const asset = await uploadMediaFile({ picked, featureKey: "general" });
      // Insert at the top so the file appears immediately, before the list refreshes.
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setNotice(isArabic ? `تم الرفع (${formatBytes(asset.sizeBytes)}).` : `Uploaded (${formatBytes(asset.sizeBytes)}).`);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر رفع الملف." : "Could not upload the file."));
      setNotice(null);
    } finally { setBusy(null); }
  };

  const visibleAssets = assets.filter((asset) => filter === "all" || (filter === "image" && asset.kind === "image") || (filter === "video" && asset.kind === "video") || (filter === "file" && asset.kind === "raw")).filter((asset) => !search.trim() || `${asset.filename ?? ""} ${String(asset.metadata.prompt ?? "")}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase(isArabic ? "ar" : "en")));

  const copy = async (url: string) => {
    try { await Clipboard.setStringAsync(url); setNotice(isArabic ? "تم نسخ رابط الملف." : "File link copied."); }
    catch { setError(isArabic ? "تعذر النسخ. اضغط مطولًا على الرابط لنسخه." : "Could not copy. Long-press the link to copy it."); }
  };

  const confirmDeleteAsset = (asset: MediaAsset) => {
    Alert.alert(isArabic ? "حذف الملف" : "Delete file", isArabic ? "سيتم حذف الملف من التخزين والمكتبة إذا لم يكن مرتبطًا بمحادثة أو تذكرة دعم. لا يمكن التراجع عن الحذف." : "The file will be removed from storage and the library if it is not linked to a chat or support ticket. This cannot be undone.", [
      { text: isArabic ? "إلغاء" : "Cancel", style: "cancel" },
      { text: isArabic ? "حذف" : "Delete", style: "destructive", onPress: () => {
        void (async () => {
          setDeletingId(asset.id); setError(null); setNotice(null);
          try {
            await deleteMediaAsset(asset.id);
            setAssets((current) => current.filter((item) => item.id !== asset.id));
            setNotice(isArabic ? "تم حذف الملف من مكتبتك." : "File deleted from your library.");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر حذف الملف." : "Could not delete the file."));
          } finally { setDeletingId(null); }
        })();
      } },
    ]);
  };

  const reuseImageInChat = async (asset: MediaAsset) => {
    if (asset.kind !== "image" || reuseBusyId) return;
    setReuseBusyId(asset.id); setError(null); setNotice(null);
    try {
      const conversation = await chatService.createConversation(isArabic ? "محادثة حول صورة من مكتبتي" : "Chat about an image from my library");
      await chatService.sendMessage({
        conversationId: conversation.id,
        content: isArabic ? "حلّل الصورة المرفقة من مكتبتي. صف محتواها وأسلوبها، واقترح طرقًا عملية لتطويرها." : "Analyze the attached image from my library. Describe its content and style, and suggest practical ways to improve it.",
        modelProfileKey: "auto",
        mediaAsset: asset,
        signal: new AbortController().signal,
        onUserSaved: () => undefined,
        onChunk: () => undefined,
      });
      router.push("/(protected)/chat");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر بدء محادثة حول الصورة." : "Could not start a chat about the image."));
    } finally { setReuseBusyId(null); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <Text style={styles.title}>{isArabic ? "مكتبة SULY" : "SULY Library"}</Text>
      <Pressable onPress={() => void load()}><Text style={styles.link}>{isArabic ? "تحديث" : "Refresh"}</Text></Pressable>
    </View>
    <Text style={styles.explainer}>{isArabic ? "كل ملفاتك ومرفقات محادثاتك ومخرجات الاستوديو في مكان واحد. الملفات الخاصة لا تظهر إلا لصاحبها أو لمن يملك صلاحية الوصول." : "Your files, chat attachments, and Studio outputs in one place. Private files are visible only to their owner or an authorized user."}</Text>
    <TextInput value={search} onChangeText={setSearch} placeholder={isArabic ? "ابحث باسم الملف أو وصفه" : "Search by file name or description"} placeholderTextColor={colors.textMuted} style={styles.search} />
    {isAdmin && (
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void pickAndUpload("image")} style={[styles.actionButton, busy !== null && styles.disabled]}>
          <Text style={styles.actionText}>{busy === "image" ? (isArabic ? "جارٍ رفع الصورة…" : "Uploading image…") : (isArabic ? "رفع صورة (مشرف)" : "Upload image (admin)")}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void pickAndUpload("video")} style={[styles.actionButton, busy !== null && styles.disabled]}>
          <Text style={styles.actionText}>{busy === "video" ? (isArabic ? "جارٍ رفع الفيديو…" : "Uploading video…") : (isArabic ? "رفع فيديو (مشرف)" : "Upload video (admin)")}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void pickAndUpload("document")} style={[styles.ghostButton, busy !== null && styles.disabled]}>
          <Text style={styles.ghostText}>{busy === "document" ? (isArabic ? "جارٍ الرفع…" : "Uploading…") : (isArabic ? "رفع ملف (مشرف)" : "Upload file (admin)")}</Text>
        </Pressable>
      </View>
    )}

    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.success}>{notice}</Text> : null}
    {busy ? <ActivityIndicator color={colors.primary} /> : null}

    <View style={styles.filters}>
      {([
        ["all", isArabic ? "الكل" : "All"],
        ["image", isArabic ? "الصور" : "Images"],
        ["video", isArabic ? "الفيديوهات" : "Videos"],
        ["file", isArabic ? "الملفات" : "Files"],
        ["in_progress", isArabic ? "قيد التنفيذ" : "In progress"],
      ] as const).map(([key, label]) => <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filterChip, filter === key && styles.filterChipSelected]}>
        <Text style={[styles.filterText, filter === key && styles.filterTextSelected]}>{label}</Text>
      </Pressable>)}
    </View>
    {filter === "in_progress" ? (jobs.length ? <View style={styles.jobsList}>
      {jobs.map((job) => <View key={job.id} style={styles.jobCard}>
        <View style={styles.jobHeader}>
          <Text style={styles.jobStatus}>{job.status === "queued" ? (isArabic ? "في قائمة الانتظار" : "Queued") : (isArabic ? "جاري التنفيذ" : "Running")}</Text>
          <Text style={styles.meta}>{job.serviceType === "video" ? (isArabic ? "فيديو" : "Video") : (isArabic ? "صورة" : "Image")} · {job.estimatedCredits.toLocaleString(isArabic ? "ar-EG" : "en-US")} Credits</Text>
        </View>
        <Text numberOfLines={3} style={styles.filename}>{job.prompt}</Text>
        <Text style={styles.meta}>{new Date(job.createdAt).toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text>
      </View>)}
    </View> : <Text style={styles.empty}>لا توجد مهام وسائط قيد التنفيذ مسجلة حاليًا.</Text>) : null}
    {!loading && filter !== "in_progress" && visibleAssets.length === 0 ? <Text style={styles.empty}>{assets.length === 0 ? (isArabic ? "لا يوجد ملف بعد. ابدأ برفع صورة." : "No files yet. Start by uploading an image.") : (isArabic ? "لا توجد عناصر في هذا التصنيف." : "No items in this category.")}</Text> : null}
    <View style={styles.grid}>
      {filter !== "in_progress" ? visibleAssets.map((asset) => <View key={asset.id || asset.url} style={styles.card}>
        {asset.kind === "raw" || asset.kind === "video"
          ? <View style={[styles.thumb, styles.fileThumb]}><Text style={styles.fileIcon}>{asset.kind === "video" ? "VIDEO" : "FILE"}</Text></View>
          : <Image source={{ uri: asset.url }} style={styles.thumb} resizeMode="cover" accessibilityLabel={asset.filename ?? (isArabic ? "صورة" : "Image")}/>}
        <Text numberOfLines={1} style={styles.filename}>{asset.filename ?? (isArabic ? "ملف" : "File")}</Text>
        <Text style={styles.meta}>{asset.kind === "video" ? (isArabic ? "فيديو" : "Video") : asset.kind === "image" ? (isArabic ? "صورة" : "Image") : (isArabic ? "ملف" : "File")} · {formatBytes(asset.sizeBytes)}</Text>
        {asset.width && asset.height ? <Text style={styles.meta}>{asset.width} × {asset.height}</Text> : null}
        {asset.durationSeconds ? <Text style={styles.meta}>{isArabic ? `المدة: ${asset.durationSeconds} ثانية` : `Duration: ${asset.durationSeconds} seconds`}</Text> : null}
        {asset.createdAt ? <Text style={styles.meta}>{new Date(asset.createdAt).toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text> : null}
        {typeof asset.metadata.prompt === "string" ? <Text numberOfLines={2} style={styles.promptMeta}>{asset.metadata.prompt}</Text> : null}
        {typeof asset.metadata.public_model_name === "string" ? <Text style={styles.meta}>{asset.metadata.public_model_name} · {String(asset.metadata.quality ?? "")}</Text> : null}
        {typeof asset.metadata.charged_credits === "number" ? <Text style={styles.meta}>{asset.metadata.charged_credits.toLocaleString(isArabic ? "ar-EG" : "en-US")} Credits</Text> : null}
        <View style={styles.assetActions}>
          <Pressable onPress={() => void Linking.openURL(asset.url)}><Text style={styles.link}>{isArabic ? "فتح / تنزيل" : "Open / Download"}</Text></Pressable>
          <Pressable onPress={() => void copy(asset.url)}><Text style={styles.link}>{isArabic ? "نسخ الرابط" : "Copy link"}</Text></Pressable>
          {asset.kind === "image" ? <Pressable disabled={reuseBusyId !== null} onPress={() => void reuseImageInChat(asset)}><Text style={[styles.link, reuseBusyId === asset.id && styles.disabledText]}>{reuseBusyId === asset.id ? (isArabic ? "جارٍ فتح المحادثة…" : "Opening chat…") : (isArabic ? "استخدم في محادثة" : "Use in chat")}</Text></Pressable> : null}
          <Pressable disabled={deletingId !== null} onPress={() => confirmDeleteAsset(asset)}><Text style={[styles.link, deletingId === asset.id && styles.disabledText]}>{deletingId === asset.id ? (isArabic ? "جارٍ الحذف…" : "Deleting…") : (isArabic ? "حذف" : "Delete")}</Text></Pressable>
        </View>
      </View>) : null}
    </View>
  </ScrollView>;
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 16, gap: 12 },
  header: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  explainer: { color: colors.textSecondary, lineHeight: 21, textAlign: isArabic ? "right" : "left" },
  search: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, color: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 10, textAlign: isArabic ? "right" : "left" },
  himsCard: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  himsIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  himsIconText: { color: colors.primary, fontWeight: "900", fontSize: 18 },
  himsCopy: { flex: 1, gap: 3 },
  himsTitle: { color: colors.textPrimary, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  himsArrow: { color: colors.primary, fontSize: 25, fontWeight: "800" },
  actions: { flexDirection: isArabic ? "row-reverse" : "row", gap: 10, flexWrap: "wrap" },
  assetActions: { flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 12 },
  disabledText: { opacity: 0.5 },
  filters: { flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 7 },
  jobsList: { gap: 9 },
  jobCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, padding: 12, gap: 7 },
  jobHeader: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" },
  jobStatus: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  filterChip: { borderWidth: 1, borderColor: colors.divider, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  filterChipSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
  filterText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  filterTextSelected: { color: colors.primary },
  actionButton: { flexGrow: 1, minWidth: 130, minHeight: 46, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  actionText: { color: "#FFFFFF", fontWeight: "700" },
  ghostButton: { flexGrow: 1, minWidth: 130, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  ghostText: { color: colors.accent, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  error: { color: colors.error, textAlign: isArabic ? "right" : "left" },
  success: { color: colors.success, textAlign: isArabic ? "right" : "left" },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 8 },
  grid: { flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 12 },
  card: { width: 160, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 8, gap: 4 },
  thumb: { width: "100%", height: 110, borderRadius: 8, backgroundColor: colors.surfaceElevated },
  fileThumb: { alignItems: "center", justifyContent: "center" },
  fileIcon: { color: colors.textMuted, fontWeight: "800" },
  filename: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: isArabic ? "right" : "left" },
  meta: { color: colors.textSecondary, fontSize: 12, textAlign: isArabic ? "right" : "left" },
  promptMeta: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left", lineHeight: 15 },
  link: { color: colors.accent, fontWeight: "700", textAlign: isArabic ? "right" : "left" },
});
