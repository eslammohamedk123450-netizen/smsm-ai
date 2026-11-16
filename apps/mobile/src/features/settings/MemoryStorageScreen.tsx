import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useAuth } from "../auth/auth-provider";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { useAppLocale } from "../../theme/LocaleProvider";

type MemoryItem = { id: string; content: string; created_at: string };

export default function MemoryStorageScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadMemories = useCallback(async (refresh = false) => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("agent_memories")
        .select("id,content,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      setItems(Array.isArray(data) ? data as MemoryItem[] : []);
    } catch {
      setError(isArabic ? "تعذر تحميل الذاكرة الآن. حاول مرة أخرى." : "Memory could not be loaded. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isArabic]);

  useFocusEffect(useCallback(() => {
    void loadMemories();
  }, [loadMemories]));

  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString(isArabic ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={isArabic ? "رجوع" : "Back"}>
          <Ionicons name="arrow-forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isArabic ? "ذاكرة التخزين" : "Memory storage"}</Text>
        <TouchableOpacity onPress={() => void loadMemories(true)} style={styles.refreshButton} accessibilityRole="button" accessibilityLabel={isArabic ? "تحديث" : "Refresh"} disabled={refreshing || loading}>
          {refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh" size={20} color={colors.textPrimary} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{isArabic ? "ما الذي يتذكره SULY؟" : "What does SULY remember?"}</Text>
          <Text style={styles.noticeBody}>{isArabic
            ? "هذه قائمة بالذكريات النصية المحفوظة لحسابك لتحسين المحادثات. يتم جلب سجلات حسابك فقط، ولا تُعرض بيانات حسابات أخرى."
            : "This is the list of text memories saved for your account to improve conversations. Only your account records are requested."}</Text>
          <Text style={styles.noticeFoot}>{isArabic
            ? "العرض متاح الآن. تعديل الذكريات أو حذفها لم يُفعّل بعد، ولن تُحذف أي بيانات من هذه الصفحة."
            : "Viewing is available now. Editing and deletion are not enabled yet; this page will not delete any data."}</Text>
        </View>

        <View style={styles.countRow}>
          <Text style={styles.sectionTitle}>{isArabic ? "الذكريات المحفوظة" : "Saved memories"}</Text>
          <Text style={styles.count}>{loading ? "—" : items.length.toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text>
        </View>

        {loading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>{isArabic ? "جارٍ تحميل الذاكرة…" : "Loading memories…"}</Text></View> : null}
        {!loading && error ? (
          <View style={styles.state}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity onPress={() => void loadMemories()} style={styles.retryButton}><Text style={styles.retryText}>{isArabic ? "إعادة المحاولة" : "Try again"}</Text></TouchableOpacity>
          </View>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <View style={styles.state}><Ionicons name="bulb-outline" size={28} color={colors.textMuted} /><Text style={styles.stateText}>{isArabic ? "لا توجد ذكريات محفوظة حتى الآن." : "No saved memories yet."}</Text></View>
        ) : null}
        {!loading && !error ? items.map((item) => (
          <View key={item.id} style={styles.memoryCard}>
            <Text style={styles.memoryContent}>{item.content}</Text>
            <Text style={styles.memoryDate}>{formatDate(item.created_at)}</Text>
          </View>
        )) : null}
        {!loading && items.length === 100 ? <Text style={styles.limitNote}>{isArabic ? "يُعرض أحدث 100 سجل فقط في هذه الصفحة." : "Only the latest 100 records are shown on this page."}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemePalette, isArabic: boolean) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 12, maxWidth: 900, width: "100%", alignSelf: "center" },
    header: { minHeight: 54, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
    backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    refreshButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "800" },
    notice: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 14, gap: 8 },
    noticeTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
    noticeBody: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, textAlign: isArabic ? "right" : "left" },
    noticeFoot: { color: colors.textMuted, fontSize: 11, lineHeight: 18, textAlign: isArabic ? "right" : "left" },
    countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
    sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
    count: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
    memoryCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 14, gap: 10 },
    memoryContent: { color: colors.textPrimary, fontSize: 13, lineHeight: 21, textAlign: isArabic ? "right" : "left" },
    memoryDate: { color: colors.textMuted, fontSize: 10, textAlign: isArabic ? "right" : "left" },
    state: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 10 },
    stateText: { color: colors.textSecondary, fontSize: 12, textAlign: "center" },
    error: { color: colors.error, fontSize: 12, textAlign: "center" },
    retryButton: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9, backgroundColor: colors.surface },
    retryText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
    limitNote: { color: colors.textMuted, fontSize: 10, textAlign: "center" },
  });
}
