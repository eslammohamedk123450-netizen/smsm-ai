import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { chatService, type Conversation } from "../chat/chat-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";
import { listTaskHistory, type TaskHistoryItem } from "../brain/task-service";

type UnifiedHistoryItem =
  | { kind: "conversation"; conversation: Conversation; updatedAt: string }
  | { kind: "task"; task: TaskHistoryItem; updatedAt: string };

const TASK_STATUS_AR: Record<TaskHistoryItem["status"], string> = { queued: "في الانتظار", running: "قيد التنفيذ", completed: "مكتملة", failed: "تعذّر إكمالها", cancelled: "ملغاة" };
const TASK_STATUS_EN: Record<TaskHistoryItem["status"], string> = { queued: "Queued", running: "Running", completed: "Completed", failed: "Failed", cancelled: "Cancelled" };

export function ConversationsScreen() {
  const router = useRouter();
  const longPressHandled = useRef(false);
  const params = useLocalSearchParams<{ filter?: string; taskId?: string | string[] }>();
  const filter = params.filter === "archived" || params.filter === "favorites" ? params.filter : "all";
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [items, setItems] = useState<Conversation[]>([]);
  const [tasks, setTasks] = useState<TaskHistoryItem[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskHistoryItem | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  useEffect(() => { if (!selected) longPressHandled.current = false; }, [selected]);
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [conversations, taskRows] = await Promise.all([
        filter === "archived" ? chatService.listArchivedConversations(200) : filter === "favorites" ? chatService.listFavoriteConversations(200) : chatService.listConversations(200),
        filter === "all" ? listTaskHistory(100).catch(() => [] as TaskHistoryItem[]) : Promise.resolve([] as TaskHistoryItem[]),
      ]);
      setItems(conversations);
      setTasks(taskRows);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحميل المحادثات." : "Could not load chats.")); }
    finally { setLoading(false); }
  }, [filter, isArabic]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const requestedTaskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;
    if (!requestedTaskId) return;
    const match = tasks.find((task) => task.jobId === requestedTaskId);
    if (match) setSelectedTask(match);
  }, [params.taskId, tasks]);

  const filtered = useMemo<UnifiedHistoryItem[]>(() => {
    const value = query.trim().toLocaleLowerCase(isArabic ? "ar" : "en");
    const combined: UnifiedHistoryItem[] = [
      ...items.map((conversation) => ({ kind: "conversation" as const, conversation, updatedAt: conversation.updatedAt })),
      ...tasks.map((task) => ({ kind: "task" as const, task, updatedAt: task.updatedAt ?? "" })),
    ];
    const scoped = filter === "favorites"
      ? combined.filter((entry) => entry.kind === "conversation" && entry.conversation.isFavorite)
      : filter === "archived"
        ? combined.filter((entry) => entry.kind === "conversation")
        : combined;
    const matching = value ? scoped.filter((entry) => entry.kind === "conversation"
      ? entry.conversation.title.toLocaleLowerCase(isArabic ? "ar" : "en").includes(value)
      : entry.task.objective.toLocaleLowerCase(isArabic ? "ar" : "en").includes(value)) : scoped;
    return matching.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [items, tasks, query, isArabic, filter]);

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
  const toggleFavorite = async () => {
    if (!selected) return;
    try {
      await chatService.setConversationFavorite(selected.id, !selected.isFavorite);
      setSelected(null);
      setNotice(selected.isFavorite ? (isArabic ? "تمت إزالة المحادثة من المفضلة." : "Chat removed from favorites.") : (isArabic ? "تمت إضافة المحادثة للمفضلة." : "Chat added to favorites."));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحديث المفضلة." : "Could not update favorites.")); }
  };

  const archiveSelected = async () => {
    if (!selected) return;
    try {
      await chatService.setConversationArchived(selected.id, true);
      setSelected(null); setNotice(isArabic ? "تمت أرشفة المحادثة." : "Chat archived.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر أرشفة المحادثة." : "Could not archive the chat.")); }
  };
  const restoreSelected = async () => {
    if (!selected) return;
    try {
      await chatService.setConversationArchived(selected.id, false);
      setSelected(null);
      setNotice(isArabic ? "تمت استعادة المحادثة." : "Chat restored.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر استعادة المحادثة." : "Could not restore the chat.")); }
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
        <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.textPrimary }]}>{filter === "archived" ? (isArabic ? "الأرشيف" : "Archive") : filter === "favorites" ? (isArabic ? "المفضلة" : "Favorites") : (isArabic ? "السجل" : "History")}</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{filter === "archived" ? (isArabic ? "المحادثات التي أرشفتها فقط." : "Only conversations you archived.") : filter === "favorites" ? (isArabic ? "محادثاتك المفضلة فقط." : "Only your favorite conversations.") : (isArabic ? "محادثاتك وتنفيذاتك في مكان واحد." : "Your conversations and task activity in one place.")}</Text></View>
        {filter === "all" ? <Pressable accessibilityRole="button" disabled={creating} onPress={() => void create()} style={[styles.newButton, { backgroundColor: colors.primary }]}>
          {creating ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="add" size={18} color={colors.onPrimary} />}
          <Text style={styles.newButtonText}>{isArabic ? "محادثة جديدة" : "New chat"}</Text>
        </Pressable> : null}
      </View>
      {filter === "all" ? <Pressable accessibilityRole="button" onPress={() => router.push("/projects")} style={[styles.projectsButton, { backgroundColor: colors.surface, borderColor: colors.divider, flexDirection: isArabic ? "row-reverse" : "row" }]}>
        <Ionicons name="folder-open-outline" size={17} color={colors.primary} />
        <Text style={[styles.projectsButtonText, { color: colors.textPrimary }]}>{isArabic ? "إدارة مشاريعي" : "My projects"}</Text>
        <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={15} color={colors.textMuted} />
      </Pressable> : null}
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput accessibilityLabel={isArabic ? "البحث في سجل المحادثات" : "Search conversation history"} value={query} onChangeText={setQuery} placeholder={isArabic ? "ابحث في السجل…" : "Search history…"} placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.textPrimary }]} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "مسح البحث" : "Clear search"} onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable> : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      {notice ? <Text style={[styles.notice, { color: colors.textSecondary }]}>{notice}</Text> : null}
      {loading ? <ActivityIndicator color={colors.textPrimary} /> : filtered.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.divider }]}><Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} /><Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{query ? (isArabic ? "لا توجد نتائج" : "No results") : (filter === "archived" ? (isArabic ? "الأرشيف فارغ" : "Archive is empty") : filter === "favorites" ? (isArabic ? "لا توجد محادثات مفضلة" : "No favorite chats") : (isArabic ? "ابدأ أول محادثة" : "Start your first chat"))}</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{query ? (isArabic ? "جرّب كلمة بحث مختلفة." : "Try a different search term.") : (filter === "archived" ? (isArabic ? "المحادثات التي تؤرشفها ستظهر هنا." : "Archived chats will appear here.") : filter === "favorites" ? (isArabic ? "أضف المحادثات للمفضلة من قائمة الضغط المطول." : "Favorite chats from the long-press menu.") : (isArabic ? "كل محادثة جديدة ستظهر هنا." : "New chats will appear here."))}</Text></View>
      ) : filtered.map((entry) => entry.kind === "conversation" ? (
        <View key={`chat-${entry.conversation.id}`} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={entry.conversation.title || (isArabic ? "فتح المحادثة" : "Open conversation")} style={styles.rowMain} onPress={() => { if (longPressHandled.current) { longPressHandled.current = false; return; } router.push({ pathname: "/chat", params: { conversationId: entry.conversation.id } }); }} onLongPress={() => { longPressHandled.current = true; setSelected(entry.conversation); }} delayLongPress={350}>
            <View style={[styles.rowIcon, { backgroundColor: colors.surfaceElevated }]}><Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textPrimary} /></View>
            <View style={styles.rowCopy}><Text numberOfLines={1} style={[styles.rowTitle, { color: colors.textPrimary }]}>{entry.conversation.title || (isArabic ? "محادثة جديدة" : "New conversation")}</Text><Text style={[styles.rowDate, { color: colors.textMuted }]}>{new Date(entry.updatedAt).toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text></View>
            {entry.conversation.isPinned || entry.conversation.isFavorite ? <View style={styles.rowMarkers}>{entry.conversation.isPinned ? <Ionicons name="pin" size={15} color={colors.textMuted} /> : null}{entry.conversation.isFavorite ? <Ionicons name="star" size={15} color={colors.primary} /> : null}</View> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إجراءات المحادثة" : "Chat actions"} onPress={() => setSelected(entry.conversation)} style={styles.moreButton}><Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} /></Pressable>
        </View>
      ) : (
        <Pressable key={`task-${entry.task.jobId}`} accessibilityRole="button" accessibilityLabel={entry.task.objective || (isArabic ? "تفاصيل المهمة" : "Task details")} onPress={() => setSelectedTask(entry.task)} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <View style={[styles.rowIcon, { backgroundColor: colors.surfaceElevated }]}><Ionicons name={entry.task.status === "completed" ? "checkmark-circle-outline" : entry.task.status === "failed" ? "alert-circle-outline" : "git-branch-outline"} size={18} color={colors.textPrimary} /></View>
          <View style={styles.rowCopy}>
            <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.textPrimary }]}>{entry.task.objective}</Text>
            <Text style={[styles.rowDate, { color: colors.textMuted }]}>{new Date(entry.updatedAt || Date.now()).toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text>
            {entry.task.resultText ? <Text numberOfLines={2} style={[styles.rowDate, { color: colors.textSecondary }]}>{entry.task.resultText}</Text> : null}
          </View>
          <View style={[styles.taskStatus, { backgroundColor: colors.surfaceElevated }]}><Text style={[styles.taskStatusText, { color: colors.textSecondary }]}>{isArabic ? TASK_STATUS_AR[entry.task.status] : TASK_STATUS_EN[entry.task.status]}</Text></View>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "تحديث القائمة" : "Refresh list"} onPress={() => void load()} style={styles.refresh}><Ionicons name="refresh" size={15} color={colors.textMuted} /><Text style={[styles.refreshText, { color: colors.textMuted }]}>{isArabic ? "تحديث القائمة" : "Refresh list"}</Text></Pressable>
      <BottomSheet visible={Boolean(selected)} title={selected?.title ?? (isArabic ? "إجراءات المحادثة" : "Chat actions")} onClose={() => setSelected(null)}>
        <View style={styles.sheetActions}>
          <Pressable accessibilityRole="button" onPress={() => void toggleFavorite()} style={styles.sheetAction}><Text style={styles.sheetActionText}>{selected?.isFavorite ? (isArabic ? "إزالة من المفضلة ⭐" : "Remove from favorites ⭐") : (isArabic ? "إضافة للمفضلة ⭐" : "Add to favorites ⭐")}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={selected?.isPinned ? (isArabic ? "إلغاء تثبيت المحادثة" : "Unpin chat") : (isArabic ? "تثبيت المحادثة" : "Pin chat")} onPress={() => void togglePin()} style={styles.sheetAction}><Text style={styles.sheetActionText}>{selected?.isPinned ? (isArabic ? "إلغاء التثبيت" : "Unpin chat") : (isArabic ? "تثبيت المحادثة" : "Pin chat")}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إعادة تسمية المحادثة" : "Rename chat"} onPress={beginRename} style={styles.sheetAction}><Text style={styles.sheetActionText}>{isArabic ? "إعادة تسمية" : "Rename"}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "حذف المحادثة" : "Delete chat"} onPress={() => { setDeleteTarget(selected); setSelected(null); }} style={[styles.sheetAction, styles.dangerAction]}><Text style={styles.dangerText}>{isArabic ? "حذف المحادثة" : "Delete chat"}</Text></Pressable>
          {selected?.archivedAt ? <Pressable accessibilityRole="button" onPress={() => void restoreSelected()} style={styles.sheetAction}><Text style={styles.sheetActionText}>{isArabic ? "استعادة من الأرشيف" : "Restore from archive"}</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "أرشفة المحادثة" : "Archive chat"} onPress={() => void archiveSelected()} style={styles.sheetAction}><Text style={styles.sheetActionText}>{isArabic ? "أرشفة المحادثة" : "Archive chat"}</Text></Pressable>}
        </View>
      </BottomSheet>
      <BottomSheet visible={Boolean(renameTarget)} title={isArabic ? "إعادة تسمية المحادثة" : "Rename chat"} onClose={() => setRenameTarget(null)}>
        <TextInput accessibilityLabel={isArabic ? "اسم المحادثة الجديد" : "New chat name"} value={renameValue} onChangeText={setRenameValue} maxLength={120} style={[styles.renameInput, { color: colors.textPrimary, borderColor: colors.divider }]} placeholder={isArabic ? "اسم المحادثة" : "Chat name"} placeholderTextColor={colors.textMuted} />
        <View style={styles.sheetButtons}>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إلغاء إعادة التسمية" : "Cancel rename"} onPress={() => setRenameTarget(null)} style={styles.sheetAction}><Text style={styles.sheetActionText}>{isArabic ? "إلغاء" : "Cancel"}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "حفظ الاسم" : "Save name"} onPress={() => void saveRename()} style={[styles.sheetAction, { backgroundColor: colors.primary }]}><Text style={styles.primarySheetText}>{isArabic ? "حفظ" : "Save"}</Text></Pressable>
        </View>
      </BottomSheet>
      <BottomSheet visible={Boolean(deleteTarget)} title={isArabic ? "حذف المحادثة؟" : "Delete chat?"} onClose={() => setDeleteTarget(null)}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isArabic ? "سيتم حذف المحادثة ورسائلها نهائيًا. لا يمكن التراجع عن هذا الإجراء." : "This will permanently delete the chat and its messages. This action cannot be undone."}</Text>
        <View style={styles.sheetButtons}>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "إلغاء الحذف" : "Cancel delete"} onPress={() => setDeleteTarget(null)} style={styles.sheetAction}><Text style={styles.sheetActionText}>{isArabic ? "إلغاء" : "Cancel"}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={isArabic ? "تأكيد الحذف النهائي" : "Confirm permanent delete"} onPress={() => void deleteSelected()} style={[styles.sheetAction, styles.dangerAction]}><Text style={styles.dangerText}>{isArabic ? "حذف نهائي" : "Delete permanently"}</Text></Pressable>
        </View>
      </BottomSheet>
      <BottomSheet visible={Boolean(selectedTask)} title={isArabic ? "تفاصيل التنفيذ" : "Task details"} onClose={() => setSelectedTask(null)}>
        {selectedTask ? <View style={styles.sheetActions}>
          <Text style={styles.sheetActionText}>{isArabic ? "الطلب" : "Request"}: {selectedTask.objective}</Text>
          <Text style={styles.sheetActionText}>{isArabic ? "الحالة" : "Status"}: {isArabic ? TASK_STATUS_AR[selectedTask.status] : TASK_STATUS_EN[selectedTask.status]}</Text>
          <Text style={styles.sheetActionText}>{isArabic ? "آخر تحديث" : "Last updated"}: {selectedTask.updatedAt ? new Date(selectedTask.updatedAt).toLocaleString(isArabic ? "ar-EG" : "en-US") : (isArabic ? "غير متاح" : "Unavailable")}</Text>
          {selectedTask.resultText ? <Text selectable style={styles.sheetActionText}>{isArabic ? "النتيجة" : "Result"}: {selectedTask.resultText}</Text> : null}
        </View> : null}
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
  newButtonText: { color: colors.onPrimary, fontSize: 12, fontWeight: "800" },
  projectsButton: { minHeight: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, alignItems: "center", alignSelf: "flex-start", gap: 8 },
  projectsButtonText: { fontSize: 12, fontWeight: "700" },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 9 },
  searchInput: { flex: 1, textAlign: isArabic ? "right" : "left", fontSize: 13, paddingVertical: 8 },
  error: { textAlign: isArabic ? "right" : "left" },
  empty: { borderWidth: 1, borderRadius: 16, padding: 28, alignItems: "center", gap: 9 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  row: { minHeight: 66, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 },
  rowMain: { flex: 1, minWidth: 0, minHeight: 64, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 },
  moreButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  rowMarkers: { flexDirection: "row", alignItems: "center", gap: 5 },
  notice: { textAlign: isArabic ? "right" : "left", fontSize: 12 },
  sheetActions: { gap: 9 },
  sheetAction: { minHeight: 46, borderRadius: 11, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.divider },
  sheetActionText: { fontWeight: "700" },
  dangerAction: { borderColor: colors.divider },
  dangerText: { color: colors.textPrimary, fontWeight: "800" },
  primarySheetText: { color: colors.onPrimary, fontWeight: "800" },
  sheetButtons: { flexDirection: isArabic ? "row-reverse" : "row", gap: 9, marginTop: 14 },
  renameInput: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, textAlign: isArabic ? "right" : "left" },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 13, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  rowDate: { fontSize: 10, textAlign: isArabic ? "right" : "left" },
  taskStatus: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  taskStatusText: { fontSize: 9, fontWeight: "700" },
  refresh: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 8 },
  refreshText: { fontSize: 11 },
});
