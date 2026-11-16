import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useAuth } from "../auth/auth-provider";
import { chatService, type Conversation } from "../chat/chat-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";

export function HomeScreen() {
  const router = useRouter();
  const { profileFullName } = useAuth();
  const { isArabic } = useAppLocale();
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setRecent(await chatService.listConversations(6)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحميل المحادثات الأخيرة." : "Could not load recent chats.")); }
    finally { setLoading(false); }
  }, [isArabic]);
  useEffect(() => { void load(); }, [load]);

  const newConversation = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const conversation = await chatService.createConversation(isArabic ? "محادثة جديدة" : "New conversation");
      router.push({ pathname: "/chat", params: { conversationId: conversation.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر بدء محادثة جديدة." : "Could not start a new chat."));
    } finally { setCreating(false); }
  };

  const actions = [
    { title: isArabic ? "ابدأ محادثة" : "Start a chat", subtitle: isArabic ? "اسأل، خطط، وابنِ أفكارك" : "Ask, plan, and build your ideas", icon: "chatbubble-ellipses-outline" as const, route: "/conversations" },
    { title: isArabic ? "نفّذ مهمة" : "Run a task", subtitle: isArabic ? "قسّم العمل ودع الوكيل ينفذه" : "Break work down and let the agent execute", icon: "git-branch-outline" as const, route: "/tasks" },
    { title: isArabic ? "افتح الاستوديو" : "Open Studio", subtitle: isArabic ? "صور وفيديو وخدمات الوسائط" : "Images, video, and media tools", icon: "sparkles-outline" as const, route: "/studio" },
    { title: isArabic ? "مكتبتك" : "Your library", subtitle: isArabic ? "ملفاتك ونتائجك المحفوظة" : "Your files and saved outputs", icon: "folder-open-outline" as const, route: "/media" },
  ];

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: colors.surfaceElevated, borderColor: colors.divider, borderWidth: 1 }]}>
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>SULY · YOUR INTELLIGENT PARTNER</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{isArabic ? `أهلًا ${profileFullName?.trim() || "بك"}` : `Hello ${profileFullName?.trim() || "there"}`}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isArabic ? "إيه اللي تحب تنجزه النهارده؟" : "What would you like to get done today?"}</Text>
        <Pressable accessibilityRole="button" disabled={creating} onPress={() => void newConversation()} style={[styles.primaryButton, { backgroundColor: colors.primary }, creating && styles.disabled]}>
          {creating ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={20} color="#FFFFFF" />}
          <Text style={styles.primaryButtonText}>{creating ? (isArabic ? "جارٍ فتح محادثة…" : "Opening chat…") : (isArabic ? "محادثة جديدة" : "New chat")}</Text>
        </Pressable>
      </View>

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{isArabic ? "اختصارات سريعة" : "Quick actions"}</Text>
      <View style={styles.actionGrid}>
        {actions.map((item) => (
          <Pressable key={item.route} accessibilityRole="button" onPress={() => router.push(item.route as never)} style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={[styles.actionIcon, { backgroundColor: colors.surfaceElevated }]}><Ionicons name={item.icon} size={21} color={colors.textPrimary} /></View>
            <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.recentHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{isArabic ? "المحادثات الأخيرة" : "Recent chats"}</Text>
        <Pressable onPress={() => router.push("/conversations")}><Text style={[styles.link, { color: colors.textPrimary }]}>{isArabic ? "عرض الكل" : "View all"}</Text></Pressable>
      </View>
      {loading ? <ActivityIndicator color={colors.textPrimary} /> : recent.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}><Text style={[styles.emptyText, { color: colors.textSecondary }]}>{isArabic ? "لسه مفيش محادثات. ابدأ أول محادثة من هنا." : "No chats yet. Start your first conversation here."}</Text></View>
      ) : recent.map((item) => (
        <Pressable key={item.id} onPress={() => router.push({ pathname: "/chat", params: { conversationId: item.id } })} style={[styles.conversation, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
          <View style={styles.conversationCopy}><Text numberOfLines={1} style={[styles.conversationTitle, { color: colors.textPrimary }]}>{item.title || (isArabic ? "محادثة جديدة" : "New conversation")}</Text><Text style={[styles.conversationDate, { color: colors.textMuted }]}>{new Date(item.updatedAt).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}</Text></View>
          {item.isPinned ? <Ionicons name="pin" size={15} color={colors.textMuted} /> : <Ionicons name="chevron-back" size={17} color={colors.textMuted} />}
        </Pressable>
      ))}
      <Pressable onPress={() => void load()} style={styles.refresh}><Ionicons name="refresh" size={15} color={colors.textMuted} /><Text style={[styles.refreshText, { color: colors.textMuted }]}>{isArabic ? "تحديث المحادثات" : "Refresh chats"}</Text></Pressable>
    </ScrollView>
  );
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: 1120, alignSelf: "center", padding: 20, paddingBottom: 36, gap: 16 },
  hero: { padding: 24, borderRadius: 22, backgroundColor: "#171717", gap: 9 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1, textAlign: isArabic ? "right" : "left" },
  title: { fontSize: 27, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
  subtitle: { fontSize: 15, textAlign: isArabic ? "right" : "left" },
  primaryButton: { alignSelf: isArabic ? "flex-end" : "flex-start", minHeight: 46, borderRadius: 12, paddingHorizontal: 18, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "800" },
  disabled: { opacity: 0.55 },
  error: { textAlign: isArabic ? "right" : "left" },
  sectionTitle: { fontSize: 17, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  actionGrid: { flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 10 },
  actionCard: { flexBasis: 180, flexGrow: 1, minHeight: 130, borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  actionIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  actionTitle: { fontSize: 14, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  actionSubtitle: { fontSize: 11, lineHeight: 17, textAlign: isArabic ? "right" : "left" },
  recentHeader: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" },
  link: { fontSize: 12, fontWeight: "700" },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 18 },
  emptyText: { textAlign: isArabic ? "right" : "left" },
  conversation: { minHeight: 58, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 },
  conversationCopy: { flex: 1, gap: 3 },
  conversationTitle: { fontSize: 13, fontWeight: "700", textAlign: isArabic ? "right" : "left" },
  conversationDate: { fontSize: 10, textAlign: isArabic ? "right" : "left" },
  refresh: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 8 },
  refreshText: { fontSize: 11 },
});
