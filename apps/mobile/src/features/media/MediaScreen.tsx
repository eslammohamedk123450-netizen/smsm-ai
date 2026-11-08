import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import * as Clipboard from "expo-clipboard";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";
import { formatBytes, listMyMedia, pickMedia, uploadMediaFile, type MediaAsset, type PickKind } from "./media-service";

function posterFor(asset: MediaAsset): string {
  if (asset.kind !== "video") return asset.url;
  return asset.url.replace(/\.[A-Za-z0-9]+$/, ".jpg");
}

export function MediaScreen() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PickKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setAssets(await listMyMedia()); }
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
      // Insert at the top so the file appears the moment Cloudinary answers,
      // before the list is refreshed from Supabase.
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setNotice(`تم الرفع (${formatBytes(asset.sizeBytes)}). الرابط محفوظ في Supabase.`);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر رفع الملف.");
      setNotice(null);
    } finally { setBusy(null); }
  };

  const copy = async (url: string) => {
    try { await Clipboard.setStringAsync(url); setNotice("تم نسخ رابط الملف."); }
    catch { setError("تعذر النسخ. اضغط مطولًا على الرابط لنسخه."); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <Text style={styles.title}>مكتبة الوسائط</Text>
      <Pressable onPress={() => void load()}><Text style={styles.link}>تحديث</Text></Pressable>
    </View>
    <Text style={styles.explainer}>الملفات تُرفع إلى Cloudinary، وSupabase يحفظ الرابط والوصف فقط. الصور تُضغط قبل الرفع لتوفير المساحة.</Text>

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

    {!loading && assets.length === 0 ? <Text style={styles.empty}>لا يوجد ملف بعد. ابدأ برفع صورة.</Text> : null}
    <View style={styles.grid}>
      {assets.map((asset) => <View key={asset.id || asset.url} style={styles.card}>
        {asset.kind === "raw"
          ? <View style={[styles.thumb, styles.fileThumb]}><Text style={styles.fileIcon}>FILE</Text></View>
          : <Image source={{ uri: posterFor(asset) }} style={styles.thumb} resizeMode="cover" accessibilityLabel={asset.filename ?? "مقطع"}/>}
        <Text numberOfLines={1} style={styles.filename}>{asset.filename ?? "ملف"}</Text>
        <Text style={styles.meta}>{asset.kind === "video" ? "فيديو" : asset.kind === "image" ? "صورة" : "ملف"} · {formatBytes(asset.sizeBytes)}</Text>
        <Pressable onPress={() => void copy(asset.url)}><Text style={styles.link}>نسخ الرابط</Text></Pressable>
      </View>)}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 16, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: "800", textAlign: "right" },
  explainer: { color: colors.textSecondary, lineHeight: 21, textAlign: "right" },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
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
  link: { color: colors.accent, fontWeight: "700", textAlign: "right" },
});
