import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { chatService, type Conversation } from "../chat/chat-service";
import { useSulyTheme } from "../../theme/ThemeProvider";

export function ConversationsScreen() {
  const router = useRouter();
  const { colors } = useSulyTheme();
  const [items, setItems] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await chatService.listConversations(100)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل المحادثات."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("ar");
    return value ? items.filter((item) => item.title.toLocaleLowerCase("ar").includes(value)) : items;
  }, [items, query]);

  const create = async () => {
    if (creating) return;
    setCreating(true); setError(null);
    try {
      const conversation = await chatService.createConversation("محادثة جديدة");
      router.push({ pathname: "/chat", params: { conversationId: conversation.id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إنشاء محادثة."); }
    finally { setCreating(false); }
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.textPrimary }]}>المحادثات</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>كل نقاشاتك ومشروعاتك في مكان واحد.</Text></View>
        <Pressable accessibilityRole="button" disabled={creating} onPress={() => void create()} style={[styles.newButton, { backgroundColor: colors.primary }]}>
          {creating ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={18} color="#FFFFFF" />}
          <Text style={styles.newButtonText}>محادثة جديدة</Text>
        </Pressable>
      </View>
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="ابحث في المحادثات…" placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.textPrimary }]} />
        {query ? <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable> : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.textPrimary} /> : filtered.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.divider }]}><Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} /><Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{query ? "لا توجد نتائج" : "ابدأ أول محادثة"}</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{query ? "جرّب كلمة بحث مختلفة." : "كل محادثة جديدة ستظهر هنا."}</Text></View>
      ) : filtered.map((item) => (
        <Pressable key={item.id} onPress={() => router.push({ pathname: "/chat", params: { conversationId: item.id } })} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <View style={[styles.rowIcon, { backgroundColor: colors.surfaceElevated }]}><Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textPrimary} /></View>
          <View style={styles.rowCopy}><Text numberOfLines={1} style={[styles.rowTitle, { color: colors.textPrimary }]}>{item.title || "محادثة جديدة"}</Text><Text style={[styles.rowDate, { color: colors.textMuted }]}>{new Date(item.updatedAt).toLocaleString("ar-EG")}</Text></View>
          {item.isPinned ? <Ionicons name="pin" size={16} color={colors.textMuted} /> : null}
          <Ionicons name="chevron-back" size={17} color={colors.textMuted} />
        </Pressable>
      ))}
      <Pressable onPress={() => void load()} style={styles.refresh}><Ionicons name="refresh" size={15} color={colors.textMuted} /><Text style={[styles.refreshText, { color: colors.textMuted }]}>تحديث القائمة</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: 1040, alignSelf: "center", padding: 20, paddingBottom: 36, gap: 13 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1, gap: 4 },
  title: { fontSize: 25, fontWeight: "900", textAlign: "right" },
  subtitle: { fontSize: 13, lineHeight: 20, textAlign: "right" },
  newButton: { minHeight: 42, borderRadius: 11, paddingHorizontal: 13, flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  newButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  searchInput: { flex: 1, textAlign: "right", fontSize: 13, paddingVertical: 8 },
  error: { textAlign: "right" },
  empty: { borderWidth: 1, borderRadius: 16, padding: 28, alignItems: "center", gap: 9 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  row: { minHeight: 66, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 13, fontWeight: "800", textAlign: "right" },
  rowDate: { fontSize: 10, textAlign: "right" },
  refresh: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 8 },
  refreshText: { fontSize: 11 },
});
