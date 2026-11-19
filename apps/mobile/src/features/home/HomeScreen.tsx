import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";
import { chatService, type Conversation } from "../chat/chat-service";
import { listTaskHistory, type TaskHistoryItem } from "../brain/task-service";

type HomeItem =
  | { kind: "conversation"; id: string; title: string; updatedAt: string; conversation: Conversation }
  | { kind: "task"; id: string; title: string; updatedAt: string; task: TaskHistoryItem };

const SHORTCUTS = [
  { key: "upgrade", icon: "arrow-up-circle-outline" as const, ar: "ترقية", en: "Upgrade", route: "/upgrade" },
  { key: "library", icon: "library-outline" as const, ar: "المكتبة", en: "Library", route: "/media" },
  { key: "studio", icon: "sparkles-outline" as const, ar: "الاستوديو", en: "Studio", route: "/studio" },
  { key: "projects", icon: "folder-outline" as const, ar: "المشاريع", en: "Projects", route: "/projects" },
  { key: "skills", icon: "bulb-outline" as const, ar: "المهارات", en: "Skills", route: "/skills" },
  { key: "favorites", icon: "heart-outline" as const, ar: "المفضلة", en: "Favorites", route: "/conversations?filter=favorites" },
  { key: "archive", icon: "archive-outline" as const, ar: "الأرشيف", en: "Archive", route: "/conversations?filter=archived" },
];

const TASK_STATUS_AR: Record<TaskHistoryItem["status"], string> = {
  queued: "في الانتظار", running: "قيد التنفيذ", completed: "مكتملة", failed: "تعذّر إكمالها", cancelled: "ملغاة",
};
const TASK_STATUS_EN: Record<TaskHistoryItem["status"], string> = {
  queued: "Queued", running: "Running", completed: "Completed", failed: "Failed", cancelled: "Cancelled",
};

export function HomeScreen() {
  const router = useRouter();
  const longPressHandled = useRef(false);
  const { isArabic } = useAppLocale();
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tasks, setTasks] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  useEffect(() => { if (!selectedConversation) longPressHandled.current = false; }, [selectedConversation]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chatRows, taskRows] = await Promise.all([
        chatService.listConversations(100),
        listTaskHistory(100),
      ]);
      setConversations(chatRows);
      setTasks(taskRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحميل مهامك." : "Could not load your tasks."));
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => { void load(); }, [load]);

  const items = useMemo<HomeItem[]>(() => [
    ...conversations.map((conversation) => ({
      kind: "conversation" as const,
      id: conversation.id,
      title: conversation.title || (isArabic ? "محادثة جديدة" : "New conversation"),
      updatedAt: conversation.updatedAt,
      conversation,
    })),
    ...tasks.map((task) => ({
      kind: "task" as const,
      id: task.jobId,
      title: task.objective || (isArabic ? "مهمة جديدة" : "New task"),
      updatedAt: task.updatedAt || "",
      task,
    })),
  ].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()), [conversations, tasks, isArabic]);

  const newConversation = () => {
    // Open an unsaved draft. chat.tsx creates the database row only on first send.
    router.push("/chat");
  };

  const openItem = (item: HomeItem) => {
    if (item.kind === "conversation") {
      router.push({ pathname: "/chat", params: { conversationId: item.conversation.id } });
    } else {
      router.push({ pathname: "/conversations", params: { taskId: item.task.jobId } });
    }
  };

  const togglePin = async () => {
    if (!selectedConversation) return;
    try {
      await chatService.setConversationPinned(selectedConversation.id, !selectedConversation.isPinned);
      setSelectedConversation(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحديث التثبيت." : "Could not update pin.")); }
  };
  const toggleFavorite = async () => {
    if (!selectedConversation) return;
    try {
      await chatService.setConversationFavorite(selectedConversation.id, !selectedConversation.isFavorite);
      setSelectedConversation(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحديث المفضلة." : "Could not update favorites.")); }
  };
  const archiveConversation = async () => {
    if (!selectedConversation) return;
    try {
      await chatService.setConversationArchived(selectedConversation.id, true);
      setSelectedConversation(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذرت أرشفة المحادثة." : "Could not archive conversation.")); }
  };
  const deleteConversation = async () => {
    if (!deleteTarget) return;
    try {
      await chatService.deleteConversation(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر حذف المحادثة." : "Could not delete conversation.")); }
  };
  const formatDate = (value: string) => value
    ? new Date(value).toLocaleDateString(isArabic ? "ar-EG" : "en-US", { day: "numeric", month: "short" })
    : "";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.shortcuts, { direction: isArabic ? "rtl" : "ltr" }]} style={[styles.shortcutScroller, { direction: isArabic ? "rtl" : "ltr" }]}>
          {SHORTCUTS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={isArabic ? item.ar : item.en}
              onPress={() => router.push(item.route as never)}
              style={({ pressed }) => [
                styles.shortcut,
                { backgroundColor: colors.surface, borderColor: colors.divider },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name={item.icon} size={21} color={colors.textPrimary} />
              <Text numberOfLines={1} style={[styles.shortcutLabel, { color: colors.textPrimary }]}>{isArabic ? item.ar : item.en}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{isArabic ? "مهامي" : "My tasks"}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isArabic ? "تابع محادثاتك ومهامك من مكان واحد" : "Your conversations and tasks, all in one place"}</Text>
        </View>

        <View style={styles.listHeading}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{isArabic ? "الأخيرة" : "Recent"}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/conversations")} style={styles.viewAll}>
            <Text style={[styles.viewAllText, { color: colors.textSecondary }]}>{isArabic ? "عرض الكل" : "View all"}</Text>
            <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={14} color={colors.textSecondary} />
          </Pressable>
        </View>

        {error ? (
          <View style={[styles.stateCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
            <Text style={[styles.stateText, { color: colors.error }]}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={[styles.retry, { color: colors.textPrimary }]}>{isArabic ? "إعادة المحاولة" : "Retry"}</Text></Pressable>
          </View>
        ) : loading ? (
          <View style={[styles.stateCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <ActivityIndicator color={colors.textPrimary} />
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>{isArabic ? "جارٍ تحميل مهامك..." : "Loading your tasks..."}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={25} color={colors.textPrimary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{isArabic ? "لا توجد مهام بعد" : "No tasks yet"}</Text>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>{isArabic ? "ابدأ أول مهمة مع SULY وستظهر هنا." : "Start your first task with SULY and it will appear here."}</Text>
          </View>
        ) : (
          <View style={styles.taskList}>
            {items.map((item) => {
              const isTask = item.kind === "task";
              return (
                <Pressable
                  key={item.kind + "-" + item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  onPress={() => { if (longPressHandled.current) { longPressHandled.current = false; return; } openItem(item); }}
                  onLongPress={item.kind === "conversation" ? () => { longPressHandled.current = true; setSelectedConversation(item.conversation); } : undefined}
                  delayLongPress={350}
                  style={({ pressed }) => [
                    styles.taskCard,
                    { backgroundColor: colors.surface, borderColor: colors.divider },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.itemIcon, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons
                      name={isTask ? "git-branch-outline" : "chatbubble-outline"}
                      size={19}
                      color={colors.textPrimary}
                    />
                  </View>
                  <View style={styles.itemCopy}>
                    <Text numberOfLines={1} style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                    <Text numberOfLines={1} style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
                      {isTask
                        ? (isArabic ? TASK_STATUS_AR[item.task.status] : TASK_STATUS_EN[item.task.status])
                        : (isArabic ? "محادثة SULY" : "SULY conversation")}
                    </Text>
                  </View>
                  <Text style={[styles.itemTime, { color: colors.textMuted }]}>{formatDate(item.updatedAt)}</Text>
                  <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isArabic ? "محادثة جديدة" : "New conversation"}
        onPress={() => void newConversation()}
        style={({ pressed }) => [
          styles.createButton,
          { backgroundColor: colors.textPrimary },
          pressed && styles.pressedButton,
        ]}
      >
        {
          <>
            <Ionicons name="add" size={25} color={colors.background} />
            <Ionicons name="chatbubble-outline" size={16} color={colors.background} style={styles.createChatIcon} />
          </>
        }
      </Pressable>
      <BottomSheet visible={Boolean(selectedConversation)} title={selectedConversation?.title ?? (isArabic ? "إجراءات المحادثة" : "Conversation actions")} onClose={() => setSelectedConversation(null)}>
        <View style={styles.actionSheet}>
          <Pressable accessibilityRole="button" onPress={() => void togglePin()} style={styles.sheetAction}><Text style={[styles.sheetActionText, { color: colors.textPrimary }]}>{selectedConversation?.isPinned ? (isArabic ? "إلغاء التثبيت" : "Unpin") : (isArabic ? "تثبيت" : "Pin")}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => void toggleFavorite()} style={styles.sheetAction}><Text style={[styles.sheetActionText, { color: colors.textPrimary }]}>{selectedConversation?.isFavorite ? (isArabic ? "إزالة من المفضلة" : "Remove from favorites") : (isArabic ? "إضافة للمفضلة" : "Add to favorites")}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => void archiveConversation()} style={styles.sheetAction}><Text style={[styles.sheetActionText, { color: colors.textPrimary }]}>{isArabic ? "أرشفة" : "Archive"}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setDeleteTarget(selectedConversation); setSelectedConversation(null); }} style={styles.sheetAction}><Text style={[styles.sheetActionText, { color: colors.error }]}>{isArabic ? "حذف المحادثة" : "Delete conversation"}</Text></Pressable>
        </View>
      </BottomSheet>
      <BottomSheet visible={Boolean(deleteTarget)} title={isArabic ? "تأكيد الحذف" : "Confirm deletion"} onClose={() => setDeleteTarget(null)}>
        <Text style={{ color: colors.textSecondary, textAlign: isArabic ? "right" : "left" }}>{isArabic ? "هل تريد حذف هذه المحادثة نهائيًا؟" : "Delete this conversation permanently?"}</Text>
        <View style={styles.actionSheet}>
          <Pressable accessibilityRole="button" onPress={() => setDeleteTarget(null)} style={styles.sheetAction}><Text style={[styles.sheetActionText, { color: colors.textPrimary }]}>{isArabic ? "إلغاء" : "Cancel"}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => void deleteConversation()} style={[styles.sheetAction, { borderColor: colors.error }]}><Text style={[styles.sheetActionText, { color: colors.error }]}>{isArabic ? "حذف نهائي" : "Delete permanently"}</Text></Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: "100%", maxWidth: 1040, alignSelf: "center", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 110, gap: 22 },
  shortcutScroller: { flexGrow: 0 },
  shortcuts: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 3, paddingHorizontal: 1 },
  shortcut: { width: 82, minHeight: 76, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 6, paddingVertical: 9 },
  shortcutLabel: { fontSize: 10, fontWeight: "700", textAlign: "center" },
  heading: { gap: 5, alignItems: isArabic ? "flex-end" : "flex-start" },
  title: { fontSize: 26, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
  subtitle: { fontSize: 12, lineHeight: 19, textAlign: isArabic ? "right" : "left" },
  listHeading: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 15, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  viewAll: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 3, paddingVertical: 5 },
  viewAllText: { fontSize: 11, fontWeight: "700" },
  taskList: { gap: 9 },
  actionSheet: { gap: 9 },
  sheetAction: { minHeight: 46, borderWidth: 1, borderColor: colors.divider, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  sheetActionText: { fontWeight: "800" },
  taskCard: { minHeight: 72, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 },
  itemIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  itemCopy: { flex: 1, minWidth: 0, gap: 5 },
  itemTitle: { fontSize: 13, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  itemSubtitle: { fontSize: 10, textAlign: isArabic ? "right" : "left" },
  itemTime: { fontSize: 10 },
  stateCard: { minHeight: 100, borderWidth: 1, borderRadius: 15, padding: 18, alignItems: "center", justifyContent: "center", gap: 8 },
  stateText: { fontSize: 11, lineHeight: 18, textAlign: "center" },
  retry: { fontSize: 11, fontWeight: "800", padding: 5 },
  emptyCard: { minHeight: 210, borderWidth: 1, borderRadius: 17, padding: 24, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "900" },
  createButton: { position: "absolute", left: 18, bottom: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  createChatIcon: { position: "absolute", right: 10, bottom: 9 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.72 },
  pressedButton: { opacity: 0.82, transform: [{ scale: 0.97 }] },
});
