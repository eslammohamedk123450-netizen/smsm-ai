import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, Switch, View, useColorScheme } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import * as ExpoLinking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import { BottomSheet } from "../../../components/ui/BottomSheet";
import { useToast } from "../../../components/ui/Toast";
import { supabase } from "../../../lib/supabase/client";
import { getThemeColors } from "../../../theme/colors";

type Props = { visible: boolean; conversationId: string | null; title: string; plainText: string; onClose(): void };
function makeShareUrl(token: string): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const base = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "").replace(/\/$/, "");
    return `${window.location.origin}${base}/share/${token}`;
  }
  const explicitBase = process.env.EXPO_PUBLIC_SHARE_BASE_URL;
  if (explicitBase) return `${explicitBase.replace(/\/$/, "")}/share/${token}`;
  return ExpoLinking.createURL(`share/${token}`);
}
export function ShareConversationSheet({ visible, conversationId, title, plainText, onClose }: Props) {
  const [isPublic, setIsPublic] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const palette = getThemeColors(useColorScheme() === "light" ? "light" : "dark");
  const { show } = useToast();

  useEffect(() => {
    if (!visible || !conversationId) { setIsPublic(false); setShareUrl(null); return; }
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("suly_get_conversation_share_status", { p_conversation_id: conversationId });
        if (!alive) return;
        if (error) throw error;
        const token = typeof data === "string" ? data : null;
        setIsPublic(Boolean(token));
        setShareUrl(token ? makeShareUrl(token) : null);
      } catch {
        if (alive) { onClose(); show("تعذّر التحقق من حالة المشاركة. حاول مرة أخرى.", "error"); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [conversationId, onClose, show, visible]);

  const toggleSharing = async (enabled: boolean) => {
    if (!conversationId || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("suly_set_conversation_sharing", { p_conversation_id: conversationId, p_enabled: enabled });
      if (error) throw error;
      const token = typeof data === "string" ? data : null;
      setIsPublic(enabled);
      setShareUrl(token ? makeShareUrl(token) : null);
      // The updated state label confirms the change without placing a toast
      // behind this native modal sheet.
    } catch {
      onClose();
      show("تعذّر تغيير إعداد المشاركة. تحقق من الاتصال وحاول مجددًا.", "error");
    } finally { setSaving(false); }
  };
  const copyLink = async () => {
    if (!shareUrl) return;
    try { await Clipboard.setStringAsync(shareUrl); onClose(); show("تم نسخ رابط المشاركة.", "success"); }
    catch { onClose(); show("تعذّر نسخ الرابط.", "error"); }
  };
  const shareText = async () => {
    try {
      const message = `${title}\n\n${plainText.slice(0, 12000)}${plainText.length > 12000 ? "\n…" : ""}`;
      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.navigator.share === "function") {
        await window.navigator.share({ title, text: message });
      } else if (Platform.OS === "web") {
        await Clipboard.setStringAsync(message);
        onClose();
        show("نُسخ نص المحادثة لمشاركته.", "success");
      } else await Share.share({ message });
    } catch { onClose(); show("تعذّرت مشاركة نص المحادثة.", "error"); }
  };

  return (
    <BottomSheet visible={visible} title="مشاركة المحادثة" onClose={onClose}>
      {!conversationId ? <View style={styles.notice}><Text style={[styles.body, { color: palette.textSecondary }]}>أرسل رسالة أولًا لإنشاء محادثة قابلة للمشاركة.</Text></View> : <>
        <View style={[styles.visibilityCard, { backgroundColor: palette.surfaceElevated, borderColor: palette.divider }]}>
          <View style={styles.visibilityCopy}>
            <Text style={[styles.visibilityTitle, { color: palette.textPrimary }]}>{isPublic ? "المحادثة عامة" : "المحادثة خاصة"}</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{isPublic ? "أي شخص يملك الرابط يستطيع قراءة المحادثة." : "المحادثة متاحة لحسابك فقط."}</Text>
          </View>
          {loading || saving ? <ActivityIndicator color={palette.primary} /> : <Switch value={isPublic} onValueChange={(value) => void toggleSharing(value)} trackColor={{ false: palette.divider, true: palette.primary }} thumbColor={palette.surface} accessibilityLabel="تبديل مشاركة المحادثة" />}
        </View>
        {isPublic && shareUrl ? <Pressable onPress={() => void copyLink()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.primary, opacity: pressed ? 0.82 : 1 }]} accessibilityRole="button">
          <Text style={[styles.primaryText, { color: palette.background }]}>نسخ الرابط</Text><Text style={[styles.linkGlyph, { color: palette.background }]}>↗</Text>
        </Pressable> : null}
        <Pressable onPress={() => void shareText()} style={({ pressed }) => [styles.secondaryButton, { backgroundColor: palette.surface, borderColor: palette.divider, opacity: pressed ? 0.75 : 1 }]} accessibilityRole="button">
          <Text style={[styles.secondaryText, { color: palette.textPrimary }]}>مشاركة كنص</Text><Text style={[styles.secondaryGlyph, { color: palette.primary }]}>⇧</Text>
        </Pressable>
        {isPublic ? <Text style={[styles.warning, { color: palette.warning }]}>تنبيه: يُعرض محتوى الرسائل لمن يحصل على الرابط. يمكنك إيقاف المشاركة في أي وقت.</Text> : null}
      </>}
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  notice: { paddingVertical: 12 },
  visibilityCard: { flexDirection: "row-reverse", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  visibilityCopy: { flex: 1, alignItems: "flex-end", gap: 5 },
  visibilityTitle: { fontSize: 15, fontWeight: "700", textAlign: "right" },
  body: { fontSize: 12, lineHeight: 18, textAlign: "right" },
  primaryButton: { minHeight: 50, borderRadius: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 4 },
  primaryText: { fontSize: 14, fontWeight: "700" },
  linkGlyph: { fontSize: 18, fontWeight: "700" },
  secondaryButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 10 },
  secondaryText: { fontSize: 14, fontWeight: "600" },
  secondaryGlyph: { fontSize: 20, fontWeight: "700" },
  warning: { fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 12 },
});
