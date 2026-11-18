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
    try {
      setRecent(await chatService.listConversations(6));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر تحميل المحادثات الأخيرة." : "Could not load recent chats."));
    } finally {
      setLoading(false);
    }
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
    } finally {
      setCreating(false);
    }
  };

  const actions = [
    { title: isArabic ? "المحادثات" : "Conversations", subtitle: isArabic ? "ارجع لمحادثاتك وتابع أفكارك" : "Return to your chats and ideas", icon: "chatbubbles-outline" as const, route: "/conversations" },
    { title: isArabic ? "المهام والوكيل" : "Tasks & Agent", subtitle: isArabic ? "خطط ونفّذ الأعمال متعددة الخطوات" : "Plan and run multi-step work", icon: "git-branch-outline" as const, route: "/tasks" },
    { title: isArabic ? "الاستوديو" : "Studio", subtitle: isArabic ? "أدوات الصور والفيديو والصوت" : "Image, video, and audio tools", icon: "sparkles-outline" as const, route: "/studio" },
    { title: isArabic ? "المكتبة" : "Library", subtitle: isArabic ? "ملفاتك ونتائجك المحفوظة" : "Your files and saved outputs", icon: "folder-open-outline" as const, route: "/media" },
  ];

  const openConversation = (conversation: Conversation) => {
    router.push({ pathname: "/chat", params: { conversationId: conversation.id } });
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
        <View style={styles.heroBrandRow}>
          <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
            <Text style={styles.brandMarkText}>S</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={[styles.brandName, { color: colors.textPrimary }]}>SULY</Text>
          </View>
          <View style={styles.heroBrandSpacer} />
          <View style={[styles.workspacePill, { backgroundColor: colors.surfaceElevated, borderColor: colors.divider }]}>
            <Ionicons name="sparkles-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.workspacePillText, { color: colors.textSecondary }]}>{isArabic ? "مساحة عملك" : "Your workspace"}</Text>
          </View>
        </View>

        <View style={styles.heroCopy}>
          <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{isArabic ? "اجعل SULY يعمل من أجلك" : "MAKE SULY WORK FOR YOU"}</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isArabic ? "ابدأ من احتياجك" : "Start with what you need" }
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isArabic ? "اكتب ما تحتاجه، وسيتولى SULY مساعدتك." : "Tell SULY what you need, and let it help."}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isArabic ? "ابدأ محادثة جديدة" : "Start a new conversation"}
          disabled={creating}
          onPress={() => void newConversation()}
          style={[styles.primaryButton, { backgroundColor: colors.primary }, creating && styles.disabled]}
        >
          {creating ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="add" size={20} color={colors.onPrimary} />}
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
            {creating ? (isArabic ? "جارٍ فتح محادثة…" : "Opening chat…") : (isArabic ? "محادثة جديدة" : "New conversation")}
          </Text>
          {!creating ? <Ionicons name={isArabic ? "arrow-back" : "arrow-forward"} size={17} color={colors.onPrimary} /> : null}
        </Pressable>
      </View>

      {error ? (
        <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retryButton}>
            <Text style={[styles.retryText, { color: colors.textPrimary }]}>{isArabic ? "إعادة المحاولة" : "Try again"}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{isArabic ? "ابدأ من هنا" : "Get started"}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{isArabic ? "كل أدوات SULY الأساسية في مكان واحد" : "Your essential SULY tools, all in one place"}</Text>
        </View>
      </View>

      <View style={styles.actionGrid}>
        {actions.map((item) => (
          <Pressable
            key={item.route}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => router.push(item.route as never)}
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: colors.surface, borderColor: colors.divider },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.actionCardTop}>
              <View style={[styles.actionIcon, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name={item.icon} size={21} color={colors.textPrimary} />
              </View>
              <Ionicons name={isArabic ? "arrow-back" : "arrow-forward"} size={17} color={colors.textMuted} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{isArabic ? "كمّل من آخر مرة" : "Pick up where you left off"}</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{isArabic ? "آخر محادثاتك" : "Your latest conversations"}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push("/conversations")} style={styles.viewAll}>
            <Text style={[styles.link, { color: colors.textPrimary }]}>{isArabic ? "عرض الكل" : "View all"}</Text>
            <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={14} color={colors.textPrimary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>{isArabic ? "جارٍ تحميل محادثاتك…" : "Loading your conversations…"}</Text>
          </View>
        ) : error ? null : recent.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{isArabic ? "لسه مفيش محادثات" : "No conversations yet"}</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{isArabic ? "ابدأ أول محادثة، وسيظهر تاريخها هنا." : "Start your first chat and it will appear here."}</Text>
            <Pressable accessibilityRole="button" onPress={() => void newConversation()} disabled={creating} style={[styles.emptyAction, { borderColor: colors.divider }]}>
              <Text style={[styles.emptyActionText, { color: colors.textPrimary }]}>{isArabic ? "ابدأ الآن" : "Start now"}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.recentList}>
            {recent.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => openConversation(item)}
                style={({ pressed }) => [
                  styles.conversation,
                  { backgroundColor: colors.surface, borderColor: colors.divider },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.conversationIcon, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="chatbubble-outline" size={17} color={colors.textSecondary} />
                </View>
                <View style={styles.conversationCopy}>
                  <Text numberOfLines={1} style={[styles.conversationTitle, { color: colors.textPrimary }]}>
                    {item.title || (isArabic ? "محادثة جديدة" : "New conversation")}
                  </Text>
                  <Text style={[styles.conversationDate, { color: colors.textMuted }]}>
                    {new Date(item.updatedAt).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
                  </Text>
                </View>
                {item.isPinned ? <Ionicons name="pin" size={15} color={colors.textMuted} /> : null}
                <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={17} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        )}

        <Pressable accessibilityRole="button" onPress={() => void load()} disabled={loading} style={styles.refresh}>
          <Ionicons name="refresh" size={15} color={colors.textMuted} />
          <Text style={[styles.refreshText, { color: colors.textMuted }]}>{isArabic ? "تحديث المحادثات" : "Refresh conversations"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1 },
  content: { width: "100%", maxWidth: 1440, alignSelf: "center", paddingHorizontal: 20, paddingTop: 22, paddingBottom: 42, gap: 22 },
  hero: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 22 },
  heroBrandRow: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: colors.onPrimary, fontSize: 23, fontWeight: "900" },
  brandCopy: { gap: 2 },
  brandName: { fontSize: 15, fontWeight: "900", letterSpacing: 1.4 },
  heroBrandSpacer: { flex: 1 },
  workspacePill: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  workspacePillText: { fontSize: 10, fontWeight: "700" },
  heroCopy: { gap: 7 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1, textAlign: isArabic ? "right" : "left" },
  title: { fontSize: 29, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
  subtitle: { fontSize: 15, lineHeight: 23, textAlign: isArabic ? "right" : "left" },
  primaryButton: { alignSelf: isArabic ? "flex-end" : "flex-start", minHeight: 48, borderRadius: 13, paddingHorizontal: 17, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 9 },
  primaryButtonText: { fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  errorCard: { borderWidth: 1, borderRadius: 13, padding: 12, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 9 },
  errorText: { flex: 1, fontSize: 11, textAlign: isArabic ? "right" : "left" },
  retryButton: { paddingHorizontal: 9, paddingVertical: 7 },
  retryText: { fontSize: 10, fontWeight: "800" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeading: { gap: 4 },
  sectionTitle: { fontSize: 17, fontWeight: "900", textAlign: isArabic ? "right" : "left" },
  sectionSubtitle: { fontSize: 11, lineHeight: 17, textAlign: isArabic ? "right" : "left" },
  actionGrid: { flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 12 },
  actionCard: { flexBasis: 150, flexGrow: 1, minHeight: 145, borderWidth: 1, borderRadius: 17, padding: 15, gap: 11 },
  actionCardTop: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 14, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  actionSubtitle: { fontSize: 11, lineHeight: 17, textAlign: isArabic ? "right" : "left" },
  recentSection: { gap: 12 },
  recentHeader: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  viewAll: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 3, paddingVertical: 8, paddingLeft: 6 },
  link: { fontSize: 11, fontWeight: "800" },
  recentList: { gap: 8 },
  conversation: { minHeight: 68, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 },
  conversationIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  conversationCopy: { flex: 1, gap: 4 },
  conversationTitle: { fontSize: 12, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  conversationDate: { fontSize: 10, textAlign: isArabic ? "right" : "left" },
  loadingCard: { minHeight: 92, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { fontSize: 10 },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", gap: 8 },
  emptyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  emptyTitle: { fontSize: 14, fontWeight: "800" },
  emptyText: { fontSize: 11, lineHeight: 18, textAlign: "center" },
  emptyAction: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 8, marginTop: 4 },
  emptyActionText: { fontSize: 11, fontWeight: "800" },
  refresh: { alignSelf: "center", flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 10 },
  refreshText: { fontSize: 10, fontWeight: "600" },
  pressed: { opacity: 0.72 },
});
