import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase/client";
import { getThemeColors } from "../../src/theme/colors";

type SharedMessage = { role: "user" | "assistant"; content: string; created_at: string };
type SharedConversation = { title: string; messages: SharedMessage[] };
export default function SharedConversationPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const palette = getThemeColors(useColorScheme() === "light" ? "light" : "dark");
  const [conversation, setConversation] = useState<SharedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    let active = true;
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) { setNotFound(true); setLoading(false); return () => { active = false; }; }
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("suly_get_public_conversation", { p_share_token: token });
        if (!active) return;
        const result = !error && data && typeof data === "object" ? data as SharedConversation : null;
        if (!result) setNotFound(true); else setConversation(result);
      } catch { if (active) setNotFound(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [token]);
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={[styles.header, { borderBottomColor: palette.divider }]}>
        <Text style={[styles.brand, { color: palette.primary }]}>Suly Agent AI</Text>
        <Text style={[styles.heading, { color: palette.textPrimary }]}>{conversation?.title ?? "محادثة مشتركة"}</Text>
        <Text style={[styles.caption, { color: palette.textMuted }]}>عرض للقراءة فقط</Text>
      </View>
      {loading ? <ActivityIndicator style={styles.spinner} color={palette.primary} /> : notFound || !conversation ?
        <View style={styles.center}><Text style={[styles.notFound, { color: palette.textSecondary }]}>الرابط غير صالح أو أوقف صاحبه المشاركة.</Text></View> :
        <ScrollView contentContainerStyle={styles.messages}>
          {conversation.messages.map((message, index) => {
            const isUser = message.role === "user";
            return <View key={`${index}-${message.created_at}`} style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
              {!isUser ? <View style={[styles.avatar, { backgroundColor: palette.primary }]}><Text style={[styles.avatarText, { color: palette.background }]}>S</Text></View> : null}
              <View style={[styles.bubble, { backgroundColor: isUser ? palette.primary : palette.surface, borderColor: palette.divider }]}>
                <Text selectable style={[styles.messageText, { color: isUser ? palette.background : palette.textPrimary, textAlign: "right", writingDirection: "rtl" }]}>{message.content}</Text>
              </View>
            </View>;
          })}
        </ScrollView>}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, alignItems: "flex-end" }, brand: { fontSize: 12, fontWeight: "700" }, heading: { marginTop: 8, fontSize: 20, fontWeight: "700", textAlign: "right" }, caption: { marginTop: 5, fontSize: 12 }, spinner: { marginTop: 40 }, center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28 }, notFound: { textAlign: "center", fontSize: 15 }, messages: { paddingVertical: 18 }, messageRow: { flexDirection: "row", paddingHorizontal: 14, marginVertical: 7, alignItems: "flex-start" }, userRow: { justifyContent: "flex-end" }, assistantRow: { justifyContent: "flex-start" }, avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 8 }, avatarText: { fontWeight: "800" }, bubble: { maxWidth: "86%", paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18, borderWidth: 1 }, messageText: { fontSize: 15, lineHeight: 23 } });
