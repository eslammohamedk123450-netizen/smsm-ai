import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Appearance, Image, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { getCreditLedger, type CreditEntry } from "../credits/credit-service";
import { useAuth } from "../auth/auth-provider";
import { colors } from "../../theme/colors";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { useToast } from "../../components/ui/Toast";
import { chatService, type Conversation } from "../chat/chat-service";

type Language = "ar" | "en";

function applyColorScheme(dark: boolean): void {
  // The web runtime bundled with Expo 58 may expose Appearance without the
  // optional native setter. Persistence still works even when the setter is
  // unavailable on that platform.
  if (typeof Appearance?.setColorScheme === "function") {
    Appearance.setColorScheme(dark ? "dark" : "light");
  }
}

export default function SettingsScreen() {
  const { user, profileFullName, logout } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>("ar");
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditEntry[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [creditModal, setCreditModal] = useState(false);
  const [policyModal, setPolicyModal] = useState<"privacy" | "terms" | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);
  const [archiveVisible, setArchiveVisible] = useState(false);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const isArabic = language === "ar";

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem("suly:appearance").then((value) => {
        const dark = value !== "light";
        setIsDarkMode(dark);
        applyColorScheme(dark);
      }),
      AsyncStorage.getItem("suly:language").then((value) => {
        if (value === "en" || value === "ar") setLanguage(value);
      }),
    ]);
  }, []);

  const loadCredits = useCallback(async () => {
    if (!user) return;
    setLoadingCredits(true);
    try {
      const ledger = await getCreditLedger(50);
      setBalance(ledger.balance);
      setTransactions(ledger.entries);
    } catch {
      setBalance(null);
      setTransactions([]);
    } finally { setLoadingCredits(false); }
  }, [user]);
  useEffect(() => { void loadCredits(); }, [loadCredits]);

  const changeAppearance = async (dark: boolean) => {
    setIsDarkMode(dark);
    applyColorScheme(dark);
    await AsyncStorage.setItem("suly:appearance", dark ? "dark" : "light");
  };

  const changeLanguage = async (next: Language) => {
    setLanguage(next);
    await AsyncStorage.setItem("suly:language", next);
  };

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/(auth)/login");
    } catch {
      show(isArabic ? "تعذّر تسجيل الخروج. تحقق من الاتصال وحاول مجددًا." : "Sign out failed. Check your connection and try again.", "error");
    } finally {
      setLoggingOut(false);
    }
  };

  const confirmLogout = () => setConfirmLogoutVisible(true);

  const openArchive = async () => {
    setArchiveVisible(true);
    setArchiveLoading(true);
    try { setArchivedConversations(await chatService.listArchivedConversations()); }
    catch (cause) { show(cause instanceof Error ? cause.message : "تعذر تحميل الأرشيف.", "error"); }
    finally { setArchiveLoading(false); }
  };

  const restoreConversation = async (conversation: Conversation) => {
    try {
      await chatService.setConversationArchived(conversation.id, false);
      setArchivedConversations((current) => current.filter((item) => item.id !== conversation.id));
      show("تمت استعادة المحادثة.", "success");
    } catch (cause) { show(cause instanceof Error ? cause.message : "تعذر استعادة المحادثة.", "error"); }
  };

  const transactionTitle = (entry: CreditEntry) => {
    if (entry.task_title && entry.event_type === "settle") return `${isArabic ? "مهمة" : "Task"}: ${entry.task_title}`;
    if (entry.reason) return entry.reason;
    if (entry.event_type === "settle") return isArabic ? "استخدام رصيد لمهمة" : "Credits used for a task";
    if (entry.event_type === "reserve") return isArabic ? "حجز رصيد لمهمة" : "Credits reserved for a task";
    if (entry.event_type === "admin_adjust") return isArabic ? "تعديل رصيد" : "Balance adjustment";
    return entry.source || (isArabic ? "معاملة رصيد" : "Credit transaction");
  };

  const name = profileFullName?.trim() || "Suly";
  const avatarUrl = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;
  const back = () => { if (router.canGoBack()) router.back(); else router.replace("/(protected)/chat"); };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.heading}>{isArabic ? "الإعدادات" : "Settings"}</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={back} style={styles.backButton} accessibilityRole="button" accessibilityLabel={isArabic ? "رجوع" : "Back"}><Text style={styles.backIcon}>↩</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{isArabic ? "الحساب" : "Account"}</Text>
        <View style={styles.card}>
          <View style={styles.avatar}>{avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>}</View>
          <View style={styles.accountCopy}>
            <Text style={styles.userName}>{name}</Text>
            <Text style={styles.email}>{user?.email ?? "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{isArabic ? "المظهر" : "Appearance"}</Text>
        <View style={styles.cardRow}>
          <Text style={styles.rowText}>{isDarkMode ? (isArabic ? "داكن" : "Dark") : (isArabic ? "فاتح" : "Light")}</Text>
          <Switch value={isDarkMode} onValueChange={(value) => void changeAppearance(value)} trackColor={{ true: colors.primary, false: colors.divider }} />
        </View>

        <Text style={styles.sectionTitle}>{isArabic ? "اللغة" : "Language"}</Text>
        <View style={styles.languageControl}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => void changeLanguage("en")} style={[styles.languageOption, language === "en" && styles.languageSelected]}><Text style={[styles.rowText, language === "en" && styles.languageSelectedText]}>English</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => void changeLanguage("ar")} style={[styles.languageOption, language === "ar" && styles.languageSelected]}><Text style={[styles.rowText, language === "ar" && styles.languageSelectedText]}>العربية</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{isArabic ? "الرصيد" : "Credits"}</Text>
        <View style={styles.creditCard}>
          <Text style={styles.balanceLabel}>{isArabic ? "الرصيد الحالي" : "Current balance"}</Text>
          <Text style={styles.balanceValue}>{loadingCredits ? "…" : balance === null ? "—" : balance.toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { setCreditModal(true); void loadCredits(); }} style={styles.historyButton} accessibilityRole="button"><Text style={styles.linkText}>{isArabic ? "عرض السجل" : "View history"}</Text></TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{isArabic ? "الدعم" : "Support"}</Text>
        <TouchableOpacity activeOpacity={0.7} style={styles.cardRow} onPress={() => router.push("/(protected)/support")} accessibilityRole="button"><Text style={styles.rowText}>{isArabic ? "الشكاوى والدعم" : "Support & complaints"}</Text><Text style={styles.chevron}>‹</Text></TouchableOpacity>

        <Text style={styles.sectionTitle}>{isArabic ? "المحادثات" : "Conversations"}</Text>
        <TouchableOpacity activeOpacity={0.7} style={styles.cardRow} onPress={() => void openArchive()} accessibilityRole="button"><Text style={styles.rowText}>{isArabic ? "الأرشيف" : "Archive"}</Text><Text style={styles.chevron}>‹</Text></TouchableOpacity>

        <Text style={styles.sectionTitle}>{isArabic ? "المعلومات والسياسات" : "Information & policies"}</Text>
        <View style={styles.policyCard}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setPolicyModal("privacy")} style={styles.policyRow}><Text style={styles.rowText}>{isArabic ? "سياسة الخصوصية" : "Privacy policy"}</Text><Text style={styles.chevron}>‹</Text></TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity activeOpacity={0.7} onPress={() => setPolicyModal("terms")} style={styles.policyRow}><Text style={styles.rowText}>{isArabic ? "شروط الاستخدام والحماية" : "Terms & safety"}</Text><Text style={styles.chevron}>‹</Text></TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.7} style={styles.logoutButton} onPress={confirmLogout} disabled={loggingOut} accessibilityRole="button">
          {loggingOut ? <ActivityIndicator color="#F87171" /> : <Text style={styles.logoutText}>{isArabic ? "تسجيل الخروج" : "Sign out"}</Text>}
        </TouchableOpacity>
      </ScrollView>

      <BottomSheet visible={creditModal} title={isArabic ? "الرصيد وسجل العمليات" : "Balance & activity"} onClose={() => setCreditModal(false)}>
        <View style={styles.sheetContent}>
          <View style={styles.balanceCard}><Text style={styles.balanceLabel}>{isArabic ? "الرصيد الحالي" : "Current balance"}</Text><Text style={styles.modalBalance}>{loadingCredits ? "…" : balance === null ? "—" : balance.toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text></View>
          <Text style={styles.sectionTitle}>{isArabic ? "سجل الرصيد" : "Credit history"}</Text>
          {loadingCredits ? <ActivityIndicator color={colors.primary} /> : <ScrollView style={styles.historyList}>
            {transactions.length === 0 ? <Text style={styles.emptyHistory}>{isArabic ? "لا توجد معاملات مسجلة." : "No transactions yet."}</Text> : transactions.map((entry) => (
              <View key={entry.id} style={styles.transaction}>
                <View style={styles.transactionCopy}><Text style={styles.transactionTitle}>{transactionTitle(entry)}</Text><Text style={styles.transactionDate}>{new Date(entry.created_at).toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text></View>
                <View style={styles.transactionAmount}><Text style={[styles.delta, entry.balance_delta >= 0 ? styles.positive : styles.negative]}>{entry.balance_delta > 0 ? "+" : ""}{entry.balance_delta}</Text><Text style={styles.balanceAfter}>{entry.task_title ? `${isArabic ? "المهمة" : "Task"}: ${entry.task_title}` : `${isArabic ? "الرصيد" : "Balance"}: ${entry.balance_after}`}</Text></View>
              </View>
            ))}
          </ScrollView>}
        </View>
      </BottomSheet>

      <BottomSheet visible={archiveVisible} title={isArabic ? "أرشيف المحادثات" : "Conversation archive"} onClose={() => setArchiveVisible(false)}>
        <View style={styles.archiveContent}>
          {archiveLoading ? <ActivityIndicator color={colors.primary} /> : archivedConversations.length === 0 ? <Text style={styles.emptyHistory}>{isArabic ? "لا توجد محادثات مؤرشفة." : "No archived conversations."}</Text> : archivedConversations.map((conversation) => (
            <View key={conversation.id} style={styles.archiveRow}>
              <TouchableOpacity activeOpacity={0.7} style={styles.archiveCopy} onPress={() => { setArchiveVisible(false); router.push({ pathname: "/(protected)/chat", params: { conversationId: conversation.id } }); }}><Text numberOfLines={2} style={styles.rowText}>{conversation.title || "محادثة بدون عنوان"}</Text></TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={() => void restoreConversation(conversation)} style={styles.restoreButton}><Text style={styles.linkText}>{isArabic ? "استعادة" : "Restore"}</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={Boolean(policyModal)} title={policyModal === "privacy" ? (isArabic ? "سياسة الخصوصية" : "Privacy policy") : (isArabic ? "شروط الاستخدام والحماية" : "Terms & safety")} onClose={() => setPolicyModal(null)}>
        <Text style={styles.policyNotice}>{isArabic ? "لا يوجد في المشروع حاليًا نص رسمي منشور لهذه السياسة. لا تُدخل بيانات شديدة الحساسية في المحادثات؛ تُرسل رسائلك إلى خدمة الذكاء الاصطناعي المرتبطة بحسابك. ينبغي لمالك التطبيق إضافة رابط السياسة والشروط الرسمية قبل الإطلاق العام." : "No official published policy text is configured in this project yet. Avoid sharing highly sensitive information; messages are sent to the AI service connected to your account. The app owner should add official policy and terms links before public release."}</Text>
        <TouchableOpacity activeOpacity={0.7} onPress={() => setPolicyModal(null)} style={styles.modalClose}><Text style={styles.newChatText}>{isArabic ? "إغلاق" : "Close"}</Text></TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={confirmLogoutVisible} title={isArabic ? "تسجيل الخروج؟" : "Sign out?"} onClose={() => setConfirmLogoutVisible(false)}>
        <Text style={styles.policyNotice}>{isArabic ? "هل تريد تسجيل الخروج من حسابك؟" : "Do you want to sign out?"}</Text>
        <View style={styles.confirmActions}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setConfirmLogoutVisible(false)} style={styles.cancelAction}><Text style={styles.cancelActionText}>{isArabic ? "إلغاء" : "Cancel"}</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { setConfirmLogoutVisible(false); void doLogout(); }} style={styles.dangerAction} disabled={loggingOut}><Text style={styles.dangerActionText}>{isArabic ? "تسجيل الخروج" : "Sign out"}</Text></TouchableOpacity>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 36 },
  header: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  heading: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  backIcon: { color: colors.textPrimary, fontSize: 25 },
  sectionTitle: { color: colors.textSecondary, marginTop: 23, marginBottom: 10, textAlign: "right", fontSize: 14, fontWeight: "600" },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  accountCopy: { flex: 1, alignItems: "flex-end" },
  userName: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  email: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  cardRow: { minHeight: 58, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  rowText: { color: colors.textPrimary, fontSize: 14 },
  languageControl: { minHeight: 50, flexDirection: "row-reverse", gap: 6, padding: 5, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, backgroundColor: colors.surface },
  languageOption: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 11, paddingVertical: 9, paddingHorizontal: 13 },
  languageSelected: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary },
  languageSelectedText: { color: colors.primary, fontWeight: "700" },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  balanceValue: { color: colors.textPrimary, fontWeight: "800", fontSize: 28 },
  creditCard: { minHeight: 142, alignItems: "center", justifyContent: "center", gap: 6, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  historyButton: { minHeight: 32, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.surfaceElevated },
  policyCard: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 15 },
  policyRow: { minHeight: 50, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  chevron: { color: colors.textMuted, fontSize: 22 },
  separator: { height: 1, backgroundColor: colors.divider },
  logoutButton: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, marginTop: 30, alignItems: "center", minHeight: 50, justifyContent: "center" },
  logoutText: { color: "#F87171", fontWeight: "700", fontSize: 15 },
  sheetContent: { maxHeight: 520 },
  archiveContent: { maxHeight: 520, gap: 8 },
  archiveRow: { minHeight: 56, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  archiveCopy: { flex: 1, alignItems: "flex-end", paddingHorizontal: 8 },
  restoreButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.surfaceElevated },
  historyList: { maxHeight: 340 },
  balanceCard: { padding: 20, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center" },
  balanceLabel: { color: colors.textSecondary, fontSize: 14 },
  modalBalance: { color: colors.primary, fontSize: 34, fontWeight: "800", marginTop: 8 },
  emptyHistory: { color: colors.textMuted, textAlign: "center", marginTop: 28 },
  transaction: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  transactionCopy: { flex: 1, alignItems: "flex-end", paddingLeft: 12 },
  transactionTitle: { color: colors.textPrimary, fontSize: 13, textAlign: "right" },
  transactionDate: { color: colors.textMuted, fontSize: 11, marginTop: 5 },
  transactionAmount: { alignItems: "flex-start" },
  delta: { fontSize: 15, fontWeight: "700" },
  positive: { color: colors.success },
  negative: { color: colors.error },
  balanceAfter: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  policyNotice: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: "right", marginTop: 15 },
  modalClose: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, marginTop: 20, alignItems: "center", justifyContent: "center" },
  newChatText: { color: colors.background, fontWeight: "700", textAlign: "center" },
  confirmActions: { flexDirection: "row-reverse", gap: 10, marginTop: 18 },
  cancelAction: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  cancelActionText: { color: colors.textPrimary, fontWeight: "600" },
  dangerAction: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: "#1F2937", alignItems: "center", justifyContent: "center" },
  dangerActionText: { color: "#F87171", fontWeight: "700" },
});
