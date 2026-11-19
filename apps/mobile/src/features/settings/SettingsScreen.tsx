import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";

import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { getCreditLedger, type CreditEntry } from "../credits/credit-service";
import { getCreditDisplay } from "../credits/credit-presentation";
import { useAuth } from "../auth/auth-provider";
import type { ThemePalette } from "../../theme/colors";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { useToast } from "../../components/ui/Toast";
import { chatService, type Conversation } from "../chat/chat-service";
import { useSulyTheme, type ThemeMode } from "../../theme/ThemeProvider";
import { supabase } from "../../lib/supabase/client";
import { useAppLocale, type AppLanguage } from "../../theme/LocaleProvider";

export default function SettingsScreen() {
  const { user, profileFullName } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const { colors, mode, effectiveMode, setMode } = useSulyTheme();
  const { language, isArabic, setLanguage } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [adminAccess, setAdminAccess] = useState<{ userId: string | null; state: "checking" | "allowed" | "denied" | "error" }>({ userId: null, state: "checking" });
  const [balance, setBalance] = useState<number | null>(null);
  const [currentTier, setCurrentTier] = useState("free");
  const [transactions, setTransactions] = useState<CreditEntry[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [creditLoadError, setCreditLoadError] = useState(false);
  const [creditModal, setCreditModal] = useState(false);
  const [policyModal, setPolicyModal] = useState<"privacy" | "terms" | null>(null);
  const [archiveVisible, setArchiveVisible] = useState(false);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveLoadError, setArchiveLoadError] = useState(false);

  const adminAccessState = adminAccess.userId === user?.id ? adminAccess.state : "checking";

  useEffect(() => {
    let active = true;
    if (!user?.id) { setCurrentTier("free"); return () => { active = false; }; }
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("suly_effective_subscription_tier", { p_user_id: user.id });
        if (active && !error && typeof data === "string") setCurrentTier(data.toLowerCase());
      } catch {
        // Keep the safe Free fallback when the subscription lookup is unavailable.
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const checkAdminAccess = useCallback(async () => {
    const userId = user?.id ?? null;
    if (!userId) {
      setAdminAccess({ userId: null, state: "denied" });
      return;
    }
    setAdminAccess({ userId, state: "checking" });
    try {
      const { data, error } = await supabase.rpc("suly_is_admin");
      setAdminAccess({ userId, state: error ? "error" : data === true ? "allowed" : "denied" });
    } catch {
      setAdminAccess({ userId, state: "error" });
    }
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    const userId = user?.id ?? null;
    if (!userId) {
      setAdminAccess({ userId: null, state: "denied" });
      return () => { active = false; };
    }
    setAdminAccess({ userId, state: "checking" });
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("suly_is_admin");
        if (active) setAdminAccess({ userId, state: error ? "error" : data === true ? "allowed" : "denied" });
      } catch {
        if (active) setAdminAccess({ userId, state: "error" });
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const loadCredits = useCallback(async () => {
    if (!user) return;
    setLoadingCredits(true);
    setCreditLoadError(false);
    try {
      const ledger = await getCreditLedger(50);
      setBalance(ledger.balance);
      setTransactions(ledger.entries);
    } catch {
      setBalance(null);
      setTransactions([]);
      setCreditLoadError(true);
    } finally { setLoadingCredits(false); }
  }, [user]);
  useEffect(() => { void loadCredits(); }, [loadCredits]);

  const changeAppearance = async (next: ThemeMode) => {
    await setMode(next);
  };

  const changeLanguage = async (next: AppLanguage) => {
    await setLanguage(next);
  };

  const openArchive = async () => {
    setArchiveVisible(true);
    setArchiveLoading(true);
    setArchiveLoadError(false);
    try { setArchivedConversations(await chatService.listArchivedConversations()); }
    catch (cause) {
      setArchivedConversations([]);
      setArchiveLoadError(true);
      show(cause instanceof Error ? cause.message : "تعذر تحميل الأرشيف.", "error");
    }
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
  const back = () => { if (router.canGoBack()) router.back(); else router.replace("/home"); };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.heading}>{isArabic ? "الحساب" : "Account"}</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={back} style={styles.backButton} accessibilityRole="button" accessibilityLabel={isArabic ? "رجوع" : "Back"}><Text style={styles.backIcon}>↩</Text></TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push("/(protected)/profile")} style={styles.profileCard} accessibilityRole="button">
          <View style={styles.avatar}>{avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>}</View>
          <View style={styles.accountCopy}>
            <Text style={styles.userName}>{name}</Text>
            <Text style={styles.accountType}>{isArabic ? "حساب شخصي" : "Personal account"}</Text>
          </View>
          <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={19} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.planCard}>
          <TouchableOpacity activeOpacity={0.7} style={[styles.planRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} onPress={() => router.push("/(protected)/upgrade")} accessibilityRole="button">
            <View style={[styles.planSummaryCopy, { alignItems: isArabic ? "flex-end" : "flex-start" }]}>
              <Text style={styles.planNameText}>{currentTier === "ultra_team" ? "Ultra Team" : currentTier.toUpperCase()}</Text>
              <Text style={styles.planHint}>{isArabic ? "الخطة الحالية" : "Current plan"}</Text>
            </View>
            <View style={styles.upgradePill}><Text style={styles.upgradePillText}>{isArabic ? "ترقية" : "Upgrade"}</Text></View>
          </TouchableOpacity>
          <View style={styles.planDivider} />
          <TouchableOpacity activeOpacity={0.7} style={[styles.creditRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} onPress={() => router.push("/(protected)/balance")} accessibilityRole="button">
            <View style={[styles.creditSummaryLabel, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="wallet-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.creditLabelText}>{isArabic ? "الرصيد" : "Credits"}</Text>
            </View>
            <View style={[styles.creditValueWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Text style={styles.creditSummaryValue}>{loadingCredits ? "…" : balance === null ? "—" : balance.toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text>
              <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>
        {creditLoadError ? <TouchableOpacity activeOpacity={0.7} onPress={() => void loadCredits()} accessibilityRole="button" style={styles.inlineRetry}><Text style={styles.linkText}>{isArabic ? "تعذر تحميل الرصيد — إعادة المحاولة" : "Could not load credits — retry"}</Text></TouchableOpacity> : null}
        <TouchableOpacity activeOpacity={0.7} onPress={() => { setCreditModal(true); void loadCredits(); }} style={styles.historyButton} accessibilityRole="button"><Text style={styles.linkText}>{isArabic ? "عرض سجل الرصيد" : "View credit history"}</Text></TouchableOpacity>

        <Text style={styles.sectionTitle}>{isArabic ? "التفضيلات" : "Preferences"}</Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity activeOpacity={0.7} style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} onPress={() => router.push("/(protected)/skills")} accessibilityRole="button">
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="sparkles-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "مهارات SULY" : "SULY skills"}</Text>
            </View>
            <View style={styles.settingValueWrap}><Text style={styles.settingHint}>{isArabic ? "مراجعة المهارات وتفعيلها" : "Review and activate skills"}</Text><Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} /></View>
          </TouchableOpacity>
          <View style={styles.groupDivider} />
          <TouchableOpacity activeOpacity={0.7} style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} onPress={() => router.push("/(protected)/integrations")} accessibilityRole="button">
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="apps-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "الموصلات والتطبيقات المرتبطة" : "Connected apps"}</Text>
            </View>
            <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.groupDivider} />
          <View style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="globe-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "اللغة" : "Language"}</Text>
            </View>
            <View style={[styles.compactOptions, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => void changeLanguage("en")} style={[styles.compactOption, language === "en" && styles.compactOptionSelected]}><Text style={[styles.compactOptionText, language === "en" && styles.compactOptionTextSelected]}>EN</Text></TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={() => void changeLanguage("ar")} style={[styles.compactOption, language === "ar" && styles.compactOptionSelected]}><Text style={[styles.compactOptionText, language === "ar" && styles.compactOptionTextSelected]}>ع</Text></TouchableOpacity>
            </View>
          </View>
          <View style={styles.groupDivider} />
          <View style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name={effectiveMode === "dark" ? "moon-outline" : "sunny-outline"} size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "المظهر" : "Appearance"}</Text>
            </View>
            <View style={[styles.compactOptions, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              {(["system", "light", "dark"] as const).map((value) => (
                <TouchableOpacity key={value} activeOpacity={0.7} onPress={() => void changeAppearance(value)} style={[styles.compactOption, mode === value && styles.compactOptionSelected]}>
                  <Text style={[styles.compactOptionText, mode === value && styles.compactOptionTextSelected]}>{value === "system" ? (isArabic ? "تلقائي" : "Auto") : value === "light" ? (isArabic ? "فاتح" : "Light") : (isArabic ? "داكن" : "Dark")}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{isArabic ? "المحتوى والبيانات" : "Content & data"}</Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity activeOpacity={0.7} style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} onPress={() => router.push("/(protected)/memory")} accessibilityRole="button">
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="hardware-chip-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "ذاكرة SULY" : "SULY memory"}</Text>
            </View>
            <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.groupDivider} />
          <TouchableOpacity activeOpacity={0.7} style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} onPress={() => router.push("/(protected)/media")} accessibilityRole="button">
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="folder-open-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "التخزين والمكتبة" : "Storage & library"}</Text>
            </View>
            <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.groupDivider} />
          <TouchableOpacity activeOpacity={0.7} style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} onPress={() => void openArchive()} accessibilityRole="button">
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="archive-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "أرشيف المحادثات" : "Conversation archive"}</Text>
            </View>
            <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{isArabic ? "الدعم والمعلومات" : "Support & information"}</Text>
        <View style={styles.settingsGroup}>
          <View style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="star-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "تقييم التطبيق" : "Rate the app"}</Text>
            </View>
            <Text style={styles.settingHint}>{isArabic ? "قريبًا" : "Coming soon"}</Text>
          </View>
          <View style={styles.groupDivider} />
          <TouchableOpacity activeOpacity={0.7} style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} onPress={() => router.push("/(protected)/support")} accessibilityRole="button">
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="help-circle-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "الشكاوى والدعم" : "Support & complaints"}</Text>
            </View>
            <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.groupDivider} />
          <View style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="information-circle-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "إصدار التطبيق" : "App version"}</Text>
            </View>
            <Text style={styles.settingHint}>{Constants.expoConfig?.version ?? "1.0.0"}</Text>
          </View>
          <View style={styles.groupDivider} />
          <TouchableOpacity activeOpacity={0.7} onPress={() => setPolicyModal("privacy")} style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} accessibilityRole="button">
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="shield-checkmark-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "سياسة الخصوصية" : "Privacy policy"}</Text>
            </View>
            <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.groupDivider} />
          <TouchableOpacity activeOpacity={0.7} onPress={() => setPolicyModal("terms")} style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} accessibilityRole="button">
            <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
              <Ionicons name="document-text-outline" size={19} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>{isArabic ? "شروط الاستخدام والحماية" : "Terms & safety"}</Text>
            </View>
            <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {adminAccessState !== "denied" ? <>
          <Text style={styles.sectionTitle}>{isArabic ? "إدارة النظام" : "Administration"}</Text>
          <View style={styles.settingsGroup}>
            {adminAccessState === "allowed" ? <TouchableOpacity activeOpacity={0.7} style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} onPress={() => router.push("/admin")} accessibilityRole="button">
              <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
                <Ionicons name="shield-checkmark-outline" size={19} color={colors.textPrimary} />
                <Text style={styles.settingLabel}>{isArabic ? "لوحة التحكم الإدارية" : "Admin dashboard"}</Text>
              </View>
              <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={colors.textSecondary} />
            </TouchableOpacity> : adminAccessState === "checking" ? <View style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]}><ActivityIndicator color={colors.primary} /><Text style={styles.settingLabel}>{isArabic ? "جارٍ التحقق من صلاحية الأدمن…" : "Checking administrator access…"}</Text></View> : <TouchableOpacity activeOpacity={0.7} style={[styles.settingRow, { flexDirection: isArabic ? "row-reverse" : "row" }]} onPress={() => void checkAdminAccess()} accessibilityRole="button">
              <View style={[styles.settingLabelWrap, { flexDirection: isArabic ? "row-reverse" : "row" }]}>
                <Ionicons name="refresh-outline" size={19} color={colors.textPrimary} />
                <Text style={styles.settingLabel}>{isArabic ? "تعذر التحقق — إعادة المحاولة" : "Could not verify — retry"}</Text>
              </View>
              <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>}
          </View>
        </> : null}
      </ScrollView>


      <BottomSheet visible={creditModal} title={isArabic ? "الرصيد وسجل العمليات" : "Balance & activity"} onClose={() => setCreditModal(false)}>
        <View style={styles.sheetContent}>
          <View style={styles.balanceCard}><Text style={styles.balanceLabel}>{isArabic ? "الرصيد الحالي" : "Current balance"}</Text><Text style={styles.modalBalance}>{loadingCredits ? "…" : balance === null ? "—" : balance.toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text></View>
          <Text style={styles.sectionTitle}>{isArabic ? "سجل الرصيد" : "Credit history"}</Text>
          {loadingCredits ? <ActivityIndicator color={colors.primary} /> : creditLoadError ? <View>
            <Text accessibilityRole="alert" style={styles.emptyHistory}>{isArabic ? "تعذر تحميل سجل الرصيد." : "Could not load credit history."}</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => void loadCredits()} accessibilityRole="button"><Text style={styles.linkText}>{isArabic ? "إعادة المحاولة" : "Try again"}</Text></TouchableOpacity>
          </View> : <ScrollView style={styles.historyList}>
            {transactions.length === 0 ? <Text style={styles.emptyHistory}>{isArabic ? "لا توجد معاملات مسجلة." : "No transactions yet."}</Text> : transactions.map((entry) => (
              <View key={entry.id} style={styles.transaction}>
                <View style={styles.transactionCopy}><Text style={styles.transactionTitle}>{transactionTitle(entry)}</Text><Text style={styles.transactionDate}>{new Date(entry.created_at).toLocaleString(isArabic ? "ar-EG" : "en-US")}</Text></View>
                {(() => {
                  const display = getCreditDisplay(entry);
                  const amountText = display.kind === "credit" ? `+${display.amount.toLocaleString(isArabic ? "ar-EG" : "en-US")}`
                    : display.kind === "debit" ? `-${display.amount.toLocaleString(isArabic ? "ar-EG" : "en-US")}`
                      : display.kind === "reserved" ? `${display.amount.toLocaleString(isArabic ? "ar-EG" : "en-US")} ${isArabic ? "محجوز" : "reserved"}`
                        : "0";
                  const amountStyle = display.kind === "credit" ? styles.positive : display.kind === "debit" ? styles.negative : styles.reserved;
                  return <View style={styles.transactionAmount}>
                    <Text style={[styles.delta, amountStyle]}>{amountText}</Text>
                    <Text style={styles.balanceAfter}>{entry.task_title ? `${isArabic ? "المهمة" : "Task"}: ${entry.task_title}` : `${isArabic ? "الرصيد" : "Balance"}: ${entry.balance_after}`}</Text>
                  </View>;
                })()}
              </View>
            ))}
          </ScrollView>}
        </View>
      </BottomSheet>

      <BottomSheet visible={archiveVisible} title={isArabic ? "أرشيف المحادثات" : "Conversation archive"} onClose={() => setArchiveVisible(false)}>
        <View style={styles.archiveContent}>
          {archiveLoading ? <ActivityIndicator color={colors.primary} /> : archiveLoadError ? <View>
            <Text accessibilityRole="alert" style={styles.emptyHistory}>{isArabic ? "تعذر تحميل الأرشيف." : "Could not load the archive."}</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => void openArchive()} accessibilityRole="button"><Text style={styles.linkText}>{isArabic ? "إعادة المحاولة" : "Try again"}</Text></TouchableOpacity>
          </View> : archivedConversations.length === 0 ? <Text style={styles.emptyHistory}>{isArabic ? "لا توجد محادثات مؤرشفة." : "No archived conversations."}</Text> : archivedConversations.map((conversation) => (
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


    </>
  );
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 36 },
  header: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  heading: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  backIcon: { color: colors.textPrimary, fontSize: 25 },
  sectionTitle: { color: colors.textSecondary, marginTop: 23, marginBottom: 10, textAlign: isArabic ? "right" : "left", fontSize: 14, fontWeight: "600" },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 0, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  accountCopy: { flex: 1, alignItems: isArabic ? "flex-end" : "flex-start" },
  userName: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  email: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  cardRow: { minHeight: 58, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 0, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  planSummaryCopy: { flex: 1, alignItems: isArabic ? "flex-end" : "flex-start", gap: 3 },
  planNameText: { color: colors.textPrimary, fontSize: 14, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  creditLabelText: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  upgradePill: { minHeight: 34, paddingHorizontal: 17, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  upgradePillText: { color: colors.onPrimary, fontSize: 12, fontWeight: "800" },
  creditSummaryLabel: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 9 },
  creditSummaryValue: { color: colors.textPrimary, fontSize: 17, fontWeight: "800" },
  rowText: { color: colors.textPrimary, fontSize: 14, flex: 1, textAlign: "center" },
  rowIcon: { color: colors.textPrimary },
  languageControl: { minHeight: 50, flexDirection: isArabic ? "row-reverse" : "row", gap: 6, padding: 5, borderWidth: 0, borderRadius: 16, backgroundColor: colors.surface },
  languageOption: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 11, paddingVertical: 9, paddingHorizontal: 13 },
  languageSelected: { backgroundColor: colors.primarySoft, borderWidth: 0 },
  languageSelectedText: { color: colors.textPrimary, fontWeight: "700" },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  balanceValue: { color: colors.textPrimary, fontWeight: "800", fontSize: 28 },
  creditCard: { minHeight: 142, alignItems: "center", justifyContent: "center", gap: 6, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 0 },
  historyButton: { minHeight: 32, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.surfaceElevated },
  policyCard: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 0, paddingHorizontal: 15 },
  policyRow: { minHeight: 50, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  chevron: { color: colors.textPrimary, fontSize: 22 },
  separator: { height: 1, backgroundColor: colors.surfaceElevated },
  logoutButton: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 0, marginTop: 30, alignItems: "center", minHeight: 50, justifyContent: "center" },
  logoutText: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  profileCard: { minHeight: 82, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 0, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 13 },
  accountType: { color: colors.textSecondary, marginTop: 3, fontSize: 12, fontWeight: "400", textAlign: isArabic ? "right" : "left" },
  planCard: { marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 0 },
  planRow: { minHeight: 46, alignItems: "center", justifyContent: "space-between", gap: 12 },
  planHint: { color: colors.textSecondary, fontSize: 11, fontWeight: "400", marginTop: 2, textAlign: isArabic ? "right" : "left" },
  planDivider: { height: 1, backgroundColor: colors.divider },
  creditRow: { minHeight: 46, alignItems: "center", justifyContent: "space-between", gap: 12 },
  creditValueWrap: { alignItems: "center", gap: 7 },
  inlineRetry: { paddingVertical: 6, alignItems: isArabic ? "flex-end" : "flex-start" },
  settingsGroup: { paddingHorizontal: 15, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 0 },
  settingRow: { minHeight: 54, alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 9 },
  settingLabelWrap: { flex: 1, alignItems: "center", gap: 10 },
  settingLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: isArabic ? "right" : "left" },
  settingValueWrap: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 7, maxWidth: "48%" },
  settingHint: { color: colors.textSecondary, fontSize: 11, textAlign: isArabic ? "left" : "right", flexShrink: 1 },
  groupDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  compactOptions: { alignItems: "center", gap: 5, maxWidth: "58%" },
  compactOption: { minHeight: 30, minWidth: 32, paddingHorizontal: 9, borderRadius: 9, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  compactOptionSelected: { backgroundColor: colors.primarySoft },
  compactOptionText: { color: colors.textSecondary, fontSize: 10, fontWeight: "600" },
  compactOptionTextSelected: { color: colors.textPrimary, fontWeight: "800" },
  sheetContent: { maxHeight: 520 },
  archiveContent: { maxHeight: 520, gap: 8 },
  archiveRow: { minHeight: 56, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  archiveCopy: { flex: 1, alignItems: isArabic ? "flex-end" : "flex-start", paddingHorizontal: 8 },
  restoreButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.surfaceElevated },
  historyList: { maxHeight: 340 },
  balanceCard: { padding: 20, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center" },
  balanceLabel: { color: colors.textSecondary, fontSize: 14 },
  modalBalance: { color: colors.primary, fontSize: 34, fontWeight: "800", marginTop: 8 },
  emptyHistory: { color: colors.textMuted, textAlign: "center", marginTop: 28 },
  transaction: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  transactionCopy: { flex: 1, alignItems: isArabic ? "flex-end" : "flex-start", paddingLeft: 12 },
  transactionTitle: { color: colors.textPrimary, fontSize: 13, textAlign: isArabic ? "right" : "left" },
  transactionDate: { color: colors.textMuted, fontSize: 11, marginTop: 5 },
  transactionAmount: { alignItems: "flex-start" },
  delta: { fontSize: 15, fontWeight: "700" },
  positive: { color: colors.success },
  negative: { color: colors.error },
  reserved: { color: colors.textMuted },
  balanceAfter: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  policyNotice: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: isArabic ? "right" : "left", marginTop: 15 },
  modalClose: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, marginTop: 20, alignItems: "center", justifyContent: "center" },
  newChatText: { color: colors.onPrimary, fontWeight: "700", textAlign: "center" },
  confirmActions: { flexDirection: "row-reverse", gap: 10, marginTop: 18 },
  cancelAction: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  cancelActionText: { color: colors.textPrimary, fontWeight: "600" },
  saveAction: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  saveActionText: { color: colors.onPrimary, fontWeight: "700" },
  dangerAction: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  dangerActionText: { color: colors.textPrimary, fontWeight: "700" },
});
