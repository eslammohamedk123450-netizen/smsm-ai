import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useRouter } from "expo-router";
import { chatService } from "../chat/chat-service";
import * as Clipboard from "expo-clipboard";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { deleteMediaAsset, formatBytes, listMyMedia, listMyGenerationJobs, pickMedia, uploadMediaFile, type MediaAsset, type MediaGenerationJob, type PickKind } from "./media-service";

export function MediaScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const [filter, setFilter] = useState<"all" | "image" | "video" | "in_progress">("all");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextAssets, nextJobs] = await Promise.all([listMyMedia(), listMyGenerationJobs()]);
      setAssets(nextAssets);
      setJobs(nextJobs);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل مكتبة الوسائط."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    supabase.rpc("suly_is_admin").then(({ data }) => setIsAdmin(data === true));
  }, [load]);

  const pickAndUpload = async (kind: PickKind) => {
    setBusy(kind); setError(null); setNotice(null);
    try {
      const picked = await pickMedia(kind);
      if (!picked) { setBusy(null); return; }
      setNotice(`جارٍ رفع ${picked.part.name}…`);
      const asset = await uploadMediaFile({ picked, featureKey: "general" });
      // Insert at the top so the file appears immediately, before the list refreshes.
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setNotice(`تم الرفع (${formatBytes(asset.sizeBytes)}).`);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر رفع الملف.");
      setNotice(null);
    } finally { setBusy(null); }
  };

  const visibleAssets = assets.filter((asset) => filter === "all" || (filter === "image" && asset.kind === "image") || (filter === "video" && asset.kind === "video"));

  const copy = async (url: string) => {
    try { await Clipboard.setStringAsync(url); setNotice("تم نسخ رابط الملف."); }
    catch { setError("تعذر النسخ. اضغط مطولًا على الرابط لنسخه."); }
  };

  const confirmDeleteAsset = (asset: MediaAsset) => {
    Alert.alert("حذف الملف", "سيتم حذف الملف من التخزين والمكتبة إذا لم يكن مرتبطًا بمحادثة أو تذكرة دعم. لا يمكن التراجع عن الحذف.", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => {
        void (async () => {
          setDeletingId(asset.id); setError(null); setNotice(null);
          try {
            await deleteMediaAsset(asset.id);
            setAssets((current) => current.filter((item) => item.id !== asset.id));
            setNotice("تم حذف الملف من مكتبتك.");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "تعذر حذف الملف.");
          } finally { setDeletingId(null); }
        })();
      } },
    ]);
  };

  const reuseImageInChat = async (asset: MediaAsset) => {
    if (asset.kind !== "image" || reuseBusyId) return;
    setReuseBusyId(asset.id); setError(null); setNotice(null);
    try {
      const conversation = await chatService.createConversation("محادثة حول صورة من مكتبتي");
      await chatService.sendMessage({
        conversationId: conversation.id,
        content: "حلّل الصورة المرفقة من مكتبتي. صف محتواها وأسلوبها، واقترح طرقًا عملية لتطويرها.",
        modelProfileKey: "auto",
        mediaAsset: asset,
        signal: new AbortController().signal,
        onUserSaved: () => undefined,
        onChunk: () => undefined,
      });
      router.push("/(protected)/chat");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر بدء محادثة حول الصورة.");
    } finally { setReuseBusyId(null); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <Text style={styles.title}>مكتبة الوسائط</Text>
      <Pressable onPress={() => void load()}><Text style={styles.link}>تحديث</Text></Pressable>
    </View>
    <Text style={styles.explainer}>ارفع صورك وفيديوهاتك وملفاتك للوصول إليها بأمان. الصور تُضغط قبل الرفع لتوفير المساحة.</Text>
    <Pressable accessibilityRole="button" onPress={() => router.push("/(protected)/hims")} style={styles.himsCard}>
      <View style={styles.himsIcon}><Text style={styles.himsIconText}>H</Text></View>
      <View style={styles.himsCopy}>
        <Text style={styles.himsTitle}>محتوى الجامعة · HIMS</Text>
        <Text style={styles.meta}>محاضراتك وملفاتك التعليمية، مع التحقق من صلاحية حسابك قبل عرض المحتوى.</Text>
      </View>
      <Text style={styles.himsArrow}>‹</Text>
    </Pressable>

    {isAdmin && (
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void pickAndUpload("image")} style={[styles.actionButton, busy !== null && styles.disabled]}>
          <Text style={styles.actionText}>{busy === "image" ? "جارٍ رفع الصورة…" : "رفع صورة (مشرف)"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void pickAndUpload("video")} style={[styles.actionButton, busy !== null && styles.disabled]}>
          <Text style={styles.actionText}>{busy === "video" ? "جارٍ رفع الفيديو…" : "رفع فيديو (مشرف)"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void pickAndUpload("document")} style={[styles.ghostButton, busy !== null && styles.disabled]}>
          <Text style={styles.ghostText}>{busy === "document" ? "جارٍ الرفع…" : "رفع ملف (مشرف)"}</Text>
        </Pressable>
      </View>
    )}

    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.success}>{notice}</Text> : null}
    {busy ? <ActivityIndicator color={colors.primary} /> : null}

    <View style={styles.filters}>
      {([
        ["all", "الكل"],
        ["image", "الصور"],
        ["video", "الفيديوهات"],
        ["in_progress", "قيد التنفيذ"],
      ] as const).map(([key, label]) => <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filterChip, filter === key && styles.filterChipSelected]}>
        <Text style={[styles.filterText, filter === key && styles.filterTextSelected]}>{label}</Text>
      </Pressable>)}
    </View>
    {filter === "in_progress" ? (jobs.length ? <View style={styles.jobsList}>
      {jobs.map((job) => <View key={job.id} style={styles.jobCard}>
        <View style={styles.jobHeader}>
          <Text style={styles.jobStatus}>{job.status === "queued" ? "في قائمة الانتظار" : "جاري التنفيذ"}</Text>
          <Text style={styles.meta}>{job.serviceType === "video" ? "فيديو" : "صورة"} · {job.estimatedCredits.toLocaleString("ar-EG")} Credits</Text>
        </View>
        <Text numberOfLines={3} style={styles.filename}>{job.prompt}</Text>
        <Text style={styles.meta}>{new Date(job.createdAt).toLocaleString("ar-EG")}</Text>
      </View>)}
    </View> : <Text style={styles.empty}>لا توجد مهام وسائط قيد التنفيذ مسجلة حاليًا.</Text>) : null}
    {!loading && filter !== "in_progress" && visibleAssets.length === 0 ? <Text style={styles.empty}>{assets.length === 0 ? "لا يوجد ملف بعد. ابدأ برفع صورة." : "لا توجد عناصر في هذا التصنيف."}</Text> : null}
    <View style={styles.grid}>
      {filter !== "in_progress" ? visibleAssets.map((asset) => <View key={asset.id || asset.url} style={styles.card}>
        {asset.kind === "raw" || asset.kind === "video"
          ? <View style={[styles.thumb, styles.fileThumb]}><Text style={styles.fileIcon}>{asset.kind === "video" ? "VIDEO" : "FILE"}</Text></View>
          : <Image source={{ uri: asset.url }} style={styles.thumb} resizeMode="cover" accessibilityLabel={asset.filename ?? "صورة"}/>}
        <Text numberOfLines={1} style={styles.filename}>{asset.filename ?? "ملف"}</Text>
        <Text style={styles.meta}>{asset.kind === "video" ? "فيديو" : asset.kind === "image" ? "صورة" : "ملف"} · {formatBytes(asset.sizeBytes)}</Text>
        {asset.width && asset.height ? <Text style={styles.meta}>{asset.width} × {asset.height}</Text> : null}
        {asset.durationSeconds ? <Text style={styles.meta}>المدة: {asset.durationSeconds} ثانية</Text> : null}
        {asset.createdAt ? <Text style={styles.meta}>{new Date(asset.createdAt).toLocaleString("ar-EG")}</Text> : null}
        {typeof asset.metadata.prompt === "string" ? <Text numberOfLines={2} style={styles.promptMeta}>{asset.metadata.prompt}</Text> : null}
        {typeof asset.metadata.public_model_name === "string" ? <Text style={styles.meta}>{asset.metadata.public_model_name} · {String(asset.metadata.quality ?? "")}</Text> : null}
        {typeof asset.metadata.charged_credits === "number" ? <Text style={styles.meta}>{asset.metadata.charged_credits.toLocaleString("ar-EG")} Credits</Text> : null}
        <View style={styles.assetActions}>
          <Pressable onPress={() => void Linking.openURL(asset.url)}><Text style={styles.link}>فتح / تنزيل</Text></Pressable>
          <Pressable onPress={() => void copy(asset.url)}><Text style={styles.link}>نسخ الرابط</Text></Pressable>
          {asset.kind === "image" ? <Pressable disabled={reuseBusyId !== null} onPress={() => void reuseImageInChat(asset)}><Text style={[styles.link, reuseBusyId === asset.id && styles.disabledText]}>{reuseBusyId === asset.id ? "جارٍ فتح المحادثة…" : "استخدم في محادثة"}</Text></Pressable> : null}
          <Pressable disabled={deletingId !== null} onPress={() => confirmDeleteAsset(asset)}><Text style={[styles.link, deletingId === asset.id && styles.disabledText]}>{deletingId === asset.id ? "جارٍ الحذف…" : "حذف"}</Text></Pressable>
        </View>
      </View>) : null}
    </View>
  </ScrollView>;
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 16, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: "800", textAlign: "right" },
  explainer: { color: colors.textSecondary, lineHeight: 21, textAlign: "right" },
  himsCard: { flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  himsIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  himsIconText: { color: colors.primary, fontWeight: "900", fontSize: 18 },
  himsCopy: { flex: 1, gap: 3 },
  himsTitle: { color: colors.textPrimary, fontWeight: "800", textAlign: "right" },
  himsArrow: { color: colors.primary, fontSize: 25, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  assetActions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 },
  disabledText: { opacity: 0.5 },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  jobsList: { gap: 9 },
  jobCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, padding: 12, gap: 7 },
  jobHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
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
  error: { color: colors.error, textAlign: "right" },
  success: { color: colors.success, textAlign: "right" },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: 160, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 8, gap: 4 },
  thumb: { width: "100%", height: 110, borderRadius: 8, backgroundColor: colors.surfaceElevated },
  fileThumb: { alignItems: "center", justifyContent: "center" },
  fileIcon: { color: colors.textMuted, fontWeight: "800" },
  filename: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "right" },
  meta: { color: colors.textSecondary, fontSize: 12, textAlign: "right" },
  promptMeta: { color: colors.textMuted, fontSize: 10, textAlign: "right", lineHeight: 15 },
  link: { color: colors.accent, fontWeight: "700", textAlign: "right" },
});
