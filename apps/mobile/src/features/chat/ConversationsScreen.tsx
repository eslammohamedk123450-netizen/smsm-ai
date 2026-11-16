import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { chatService, type Conversation } from "../chat/chat-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";

export function ConversationsScreen() {
  const router = useRouter();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [items, setItems] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await chatService.listConversations(200)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحميل المحادثات." : "Could not load chats.")); }
    finally { setLoading(false); }
  }, [isArabic]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase(isArabic ? "ar" : "en");
    return value ? items.filter((item) => item.title.toLocaleLowerCase(isArabic ? "ar" : "en").includes(value)) : items;
  }, [items, query, isArabic]);

  const create = async () => {
    if (creating) return;
    setCreating(true); setError(null);
    try {
      const conversation = await chatService.createConversation(isArabic ? "محادثة جديدة" : "New conversation");
      router.push({ pathname: "/chat", params: { conversationId: conversation.id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر إنشاء محادثة." : "Could not create a chat.")); }
    finally { setCreating(false); }
  };

  const togglePin = async () => {
    if (!selected) return;
    try {
      await chatService.setConversationPinned(selected.id, !selected.isPinned);
      setSelected(null); setNotice(selected.isPinned ? (isArabic ? "تم إلغاء تثبيت المحادثة." : "Chat unpinned.") : (isArabic ? "تم تثبيت المحادثة." : "Chat pinned."));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحديث المحادثة." : "Could not update the chat.")); }
  };
  const archiveSelected = async () => {
    if (!selected) return;
    try {
      await chatService.setConversationArchived(selected.id, true);
      setSelected(null); setNotice(isArabic ? "تمت أرشفة المحادثة." : "Chat archived.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر أرشفة المحادثة." : "Could not archive the chat.")); }
  };
  const beginRename = () => {
    if (!selected) return;
    setRenameTarget(selected); setRenameValue(selected.title); setSelected(null);
  };
  const saveRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await chatService.renameConversation(renameTarget.id, renameValue);
      setRenameTarget(null); setNotice(isArabic ? "تم تحديث اسم المحادثة." : "Chat renamed.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر إعادة التسمية." : "Could not rename the chat.")); }
  };
  const deleteSelected = async () => {
    if (!deleteTarget) return;
    try {
      await chatService.deleteConversation(deleteTarget.id);
      setDeleteTarget(null); setNotice(isArabic ? "تم حذف المحادثة." : "Chat deleted.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر حذف المحادثة." : "Could not delete the chat.")); }
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.textPrimary }]}>{isArabic ? "المحادثات" : "Chats"}</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isArabic ? "كل نقاشاتك ومشروعاتك في مكان واحد." : "All your conversations and projects in one place."}</Text></View>
        <Pressable accessibilityRole="button" disabled={creating} onPress={() => void create()} style={[styles.newButton, { backgroundColor: colors.primary }]}>
          {creating ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={18} color="#FFFFFF" />}
          <Text style={styles.newButtonText}>{isArabic ? "محادثة جديدة" : "New chat"}</Text>
        </Pressable>
      </View>
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder={isArabic ? "ابحث في المحادثات…" : "Search chats…"} placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.textPrimary }]} />
        {query ? <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable> : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      {notice ? <Text style={[styles.notice, { color: colors.textSecondary }]}>{notice}</Text> : null}
      {loading ? <ActivityIndicator color={colors.textPrimary} /> : filtered.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.divider }]}><Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} /><Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{query ? (isArabic ? "لا توجد نتائج" : "No results") : (isArabic ? "ابدأ أول محادثة" : "Start your first chat")}</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{query ? (isArabic ? "جرّب كلمة بحث مختلفة." : "Try a different search term.") : (isArabic ? "كل محادثة جديدة ستظهر هنا." : "New chats will appear here.")}</Text></View>
      ) : filtered.map((item) => (
        <View key={item.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <Pressable style={styles.rowMain} onPress={() => router.push({ pathname: "/chat", params: { conversationId: item.id } })}>
            <View style={[styles.rowIcon, { backgroundColor: colors.surfaceElevated }]}><Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textPrimary} /></View>
            <View style={styles.rowCopy}><Text numberOfLines={1} style={[styles.rowTitle, { color: colors.textPrimary }]}>{item.title || (isArabic ? "محادثة جديدة" : "New conversation")}</Text><Text style={[styles.rowDate, { color: colors.textMuted }]}>{new Date(item.updatedAt).toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text></View>
            {item.isPinned ? <Ionicons name="pin" size={16} color={colors.textMuted} /> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إجراءات المحادثة" : "Chat actions"} onPress={() => setSelected(item)} style={styles.moreButton}><Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} /></Pressable>
        </View>
      ))}
      <Pressable onPress={() => void load()} style={styles.refresh}><Ionicons name="refresh" size={15} color={colors.textMuted} /><Text style={[styles.refreshText, { color: colors.textMuted }]}>{isArabic ? "تحديث القائمة" : "Refresh list"}</Text></Pressable>
      <BottomSheet visible={Boolean(selected)} title={selected?.title ?? (isArabic ? "إجراءات المحادثة" : "Chat actions")} onClose={() => setSelected(null)}>
        <View style={styles.sheetActions}>
          <Pressable onPress={() => void togglePin()} style={styles.sheetAction}><Text style={styles.sheetActionText}>{selected?.isPinned ? (isArabic ? "إلغاء التثبيت" : "Unpin chat") : (isArabic ? "تثبيت المحادثة" : "Pin chat")}</Text></Pressable>
          <Pressable onPress={beginRename} style={styles.sheetAction}><Text style={styles.sheetActionText}>{isArabic ? "إعادة تسمية" : "Rename"}</Text></Pressable>
          <Pressable onPress={() => { setDeleteTarget(selected); setSelected(null); }} style={[styles.sheetAction, styles.dangerAction]}><Text style={styles.dangerText}>{isArabic ? "حذف المحادثة" : "Delete chat"}</Text></Pressable>
          <Pressable onPress={() => void archiveSelected()} style={styles.sheetAction}><Text style={styles.sheetActionText}>{isArabic ? "أرشفة المحادثة" : "Archive chat"}</Text></Pressable>
        </View>
      </BottomSheet>
      <BottomSheet visible={Boolean(renameTarget)} title={isArabic ? "إعادة تسمية المحادثة" : "Rename chat"} onClose={() => setRenameTarget(null)}>
        <TextInput value={renameValue} onChangeText={setRenameValue} maxLength={120} style={[styles.renameInput, { color: colors.textPrimary, borderColor: colors.divider }]} placeholder={isArabic ? "اسم المحادثة" : "Chat name"} placeholderTextColor={colors.textMuted} />
        <View style={styles.sheetButtons}>
          <Pressable onPress={() => setRenameTarget(null)} style={styles.sheetAction}><Text style={styles.sheetActionText}>{isArabic ? "إلغاء" : "Cancel"}</Text></Pressable>
          <Pressable onPress={() => void saveRename()} style={[styles.sheetAction, { backgroundColor: colors.primary }]}><Text style={styles.primarySheetText}>{isArabic ? "حفظ" : "Save"}</Text></Pressable>
        </View>
      </BottomSheet>
      <BottomSheet visible={Boolean(deleteTarget)} title={isArabic ? "حذف المحادثة؟" : "Delete chat?"} onClose={() => setDeleteTarget(null)}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isArabic ? "سيتم حذف المحادثة ورسائلها نهائيًا. لا يمكن التراجع عن هذا الإجراء." : "This will permanently delete the chat and its messages. This action cannot be undone."}</Text>
        <View style={styles.sheetButtons}>
          <Pressable onPress={() => setDeleteTarget(null)} style={styles.sheetAction}><Text style={styles.sheetActionText}>{isArabic ? "إلغاء" : "Cancel"}</Text></Pressable>
          <Pressable onPress={() => void deleteSelected()} style={[styles.sheetAction, styles.dangerAction]}><Text style={styles.dangerText}>{isArabic ? "حذف نهائي" : "Delete permanently"}</Text></Pressable>
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: 1040, alignSelf: "center", padding: 20, paddingBottom: 36, gap: 13 },
  header: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1, gap: 4 },
  title: { fontSize: 25, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
  subtitle: { fontSize: 13, lineHeight: 20, textAlign: isArabic ? "right" : "left" },
  newButton: { minHeight: 42, borderRadius: 11, paddingHorizontal: 13, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 6 },
  newButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 9 },
  searchInput: { flex: 1, textAlign: isArabic ? "right" : "left", fontSize: 13, paddingVertical: 8 },
  error: { textAlign: isArabic ? "right" : "left" },
  empty: { borderWidth: 1, borderRadius: 16, padding: 28, alignItems: "center", gap: 9 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  row: { minHeight: 66, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 },
  rowMain: { flex: 1, minWidth: 0, minHeight: 64, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 },
  moreButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  notice: { textAlign: isArabic ? "right" : "left", fontSize: 12 },
  sheetActions: { gap: 9 },
  sheetAction: { minHeight: 46, borderRadius: 11, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#777777" },
  sheetActionText: { fontWeight: "700" },
  dangerAction: { borderColor: "#B91C1C" },
  dangerText: { color: "#B91C1C", fontWeight: "800" },
  primarySheetText: { color: "#FFFFFF", fontWeight: "800" },
  sheetButtons: { flexDirection: isArabic ? "row-reverse" : "row", gap: 9, marginTop: 14 },
  renameInput: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, textAlign: isArabic ? "right" : "left" },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 13, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  rowDate: { fontSize: 10, textAlign: isArabic ? "right" : "left" },
  refresh: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 8 },
  refreshText: { fontSize: 11 },
});
