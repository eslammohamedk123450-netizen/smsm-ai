import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../src/components/ui/PremiumText";
import { getCreditLedger, getMonthlyCreditUsage, type CreditEntry } from "../../src/features/credits/credit-service";
import { useAuth } from "../../src/features/auth/auth-provider";
import { supabase } from "../../src/lib/supabase/client";
import { useSulyTheme } from "../../src/theme/ThemeProvider";
import type { ThemePalette } from "../../src/theme/colors";
import { useAppLocale } from "../../src/theme/LocaleProvider";

interface TransactionItem {
  id: string;
  title: string;
  type: "chat" | "recharge" | "other";
  typeLabel: string;
  points: number;
  isCredit: boolean;
  time: string;
  date: string;
}

function mapCreditEntries(entries: CreditEntry[], isArabic: boolean): TransactionItem[] {
  return entries
    .filter((entry) => entry.event_type === "settle" || entry.event_type === "admin_adjust" || entry.event_type === "expire" || entry.event_type === "daily_grant")
    .map((entry) => {
      const isCredit = entry.balance_delta > 0;
      const isSettlement = entry.event_type === "settle";
      const isDailyGrant = entry.event_type === "daily_grant";
      const isReward = entry.source === "rewarded_ad";
      const date = new Date(entry.created_at);
      const points = isSettlement ? Math.max(0, entry.amount) : Math.abs(entry.balance_delta || entry.amount);
      const title = isSettlement
        ? entry.task_title ? `${isArabic ? "مهمة" : "Task"}: ${entry.task_title}` : (isArabic ? "استخدام رصيد لمهمة" : "Credits used for a task")
        : isDailyGrant ? (isArabic ? "الرصيد اليومي" : "Daily credits")
          : isReward ? (isArabic ? "مكافأة إعلان مكتملة" : "Completed ad reward")
          : entry.event_type === "expire" ? (isArabic ? "إعادة الرصيد غير المستخدم" : "Unused credits returned")
            : entry.reason || (isArabic ? "تعديل رصيد" : "Balance adjustment");
      return {
        id: entry.id,
        title,
        type: isSettlement ? "chat" : isCredit ? "recharge" : "other",
        typeLabel: isSettlement ? (isArabic ? "استهلاك" : "Usage") : isDailyGrant ? (isArabic ? "رصيد يومي" : "Daily credits") : isReward ? (isArabic ? "مكافأة" : "Reward") : isCredit ? (isArabic ? "إضافة رصيد" : "Credit") : (isArabic ? "تعديل" : "Adjustment"),
        points,
        isCredit,
        time: Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString(isArabic ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" }),
        date: Number.isNaN(date.getTime()) ? (isArabic ? "تاريخ غير متاح" : "Date unavailable") : date.toLocaleDateString(isArabic ? "ar-EG" : "en-US"),
      };
    });
}

export default function BalanceScreen() {
  const router = useRouter();
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const { user } = useAuth();
  const scrollRef = useRef<any>(null);
  const historyYRef = useRef<number>(0);

  const [balance, setBalance] = useState<number | null>(null);
  const [monthlyConsumed, setMonthlyConsumed] = useState<number | null>(null);
  const [monthlyAllowance, setMonthlyAllowance] = useState<number | null>(null);
  const [planTier, setPlanTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [rechargeModalVisible, setRechargeModalVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!user) {
      setBalance(null);
      setMonthlyConsumed(null);
      setMonthlyAllowance(null);
      setPlanTier(null);
      setTransactions([]);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setMonthlyConsumed(null);
    void Promise.all([
      supabase.rpc("suly_claim_daily_credits", { p_user_id: user.id }),
      getCreditLedger(100),
      supabase.rpc("suly_effective_subscription_tier", { p_user_id: user.id }),
    ])
      .then(async ([dailyGrantResult, ledger, tierResult]) => {
        if (dailyGrantResult.error) console.warn("Daily credit grant could not be refreshed:", dailyGrantResult.error.message);
        if (!active) return;
        setBalance(ledger.balance);
        setTransactions(mapCreditEntries(ledger.entries, isArabic));
        const tier = !tierResult.error && typeof tierResult.data === "string" ? tierResult.data.toLowerCase() : null;
        setPlanTier(tier);
        if (!tier || tier === "free") setMonthlyAllowance(null);
        else {
          const { data: plan } = await supabase.from("subscription_plans").select("monthly_credits,daily_credits").eq("tier_key", tier).eq("is_active", true).order("id", { ascending: false }).limit(1).maybeSingle();
          const monthly = Number(plan?.monthly_credits ?? 0) || Number(plan?.daily_credits ?? 0) * 30;
          setMonthlyAllowance(monthly > 0 ? monthly : null);
        }
      })
      .catch(() => {
        if (!active) return;
        setBalance(null);
        setTransactions([]);
        setPlanTier(null);
        setMonthlyAllowance(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void getMonthlyCreditUsage()
      .then((amount) => { if (active) setMonthlyConsumed(amount); })
      .catch(() => { if (active) setMonthlyConsumed(null); });
    return () => {
      active = false;
    };
  }, [user, isArabic]));

  const monthlySpent = monthlyConsumed ?? 0;
  const isPaidPlan = Boolean(planTier && planTier !== "free");
  const monthlyTotal = monthlyAllowance ?? 0;
  const percentage = monthlyTotal > 0 ? Math.min(100, Math.round((monthlySpent / monthlyTotal) * 100)) : 0;
  const planName = planTier ? planTier === "ultra_team" ? "Ultra Team" : planTier.charAt(0).toUpperCase() + planTier.slice(1) : "—";

  // Group transactions by date
  const grouped = transactions.reduce<Record<string, TransactionItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const scrollToHistory = () => {
    scrollRef.current?.scrollTo({ y: historyYRef.current, animated: true });
  };

  const renderIcon = (type: TransactionItem["type"]) => {
    switch (type) {
      case "recharge":
        return <Ionicons name="flash" size={16} color={colors.success} />;
      case "chat":
      case "other":
      default:
        return <Ionicons name="chatbubble-ellipses" size={16} color={colors.primary} />;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackBtn}
          accessibilityRole="button"
          accessibilityLabel={isArabic ? "العودة للمحادثة" : "Back to chat"}
        >
          <Ionicons name={isArabic ? "arrow-forward" : "arrow-back"} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isArabic ? "الرصيد والاستهلاك" : "Balance & usage"}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. الكارت العلوي: خلفية #111111 و borderRadius 16 و padding 16 */}
        <View style={styles.topCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.planName}>{planName}</Text>
            <TouchableOpacity
              onPress={() => router.push("/(protected)/upgrade")}
              style={styles.upgradeBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isArabic ? "ترقية الخطة" : "Upgrade plan"}
            >
              <Text style={styles.upgradeBtnText}>{isArabic ? "ترقية" : "Upgrade"}</Text>
            </TouchableOpacity>
          </View>

          {/* Dotted / dashed separator */}
          <View style={styles.dashedDivider} />

          {/* Current balance */}
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>{isArabic ? "الرصيد الحالي" : "Current balance"}</Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
            ) : (
              <Text style={styles.balanceNumber}>
                {balance === null ? "—" : balance.toLocaleString(isArabic ? "ar-EG" : "en-US")}
              </Text>
            )}
            <Text style={styles.balanceNotice}>
              {isPaidPlan ? (isArabic ? "رصيد الاشتراك يتجدد شهريًا" : "Subscription credits renew monthly") : (isArabic ? "الرصيد المجاني وفق الحد اليومي" : "Free balance follows the daily limit")}
            </Text>
          </View>

          {/* Two buttons: اشحن رصيد (أبيض/أسود) والسجل (#262626/أبيض) */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => setRechargeModalVisible(true)}
              style={styles.rechargeBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isArabic ? "اشحن رصيد" : "Recharge credits"}
            >
              <Text style={styles.rechargeBtnText}>{isArabic ? "اشحن رصيد" : "Recharge credits"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={scrollToHistory}
              style={styles.historyBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isArabic ? "السجل" : "History"}
            >
              <Text style={styles.historyBtnText}>{isArabic ? "السجل" : "History"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. كارت الاستهلاك: عنوان استهلاك هذا الشهر + Progress Bar */}
        <View style={styles.consumptionCard}>
          {!isPaidPlan ? <View style={styles.lockedConsumption}><Ionicons name="lock-closed" size={22} color={colors.textMuted} /><Text style={styles.lockedText}>{isArabic ? "تفاصيل الاستهلاك متاحة للمشتركين في باقة مدفوعة" : "Usage details are available on paid plans"}</Text><TouchableOpacity onPress={() => router.push("/(protected)/upgrade")} style={styles.lockedButton}><Text style={styles.lockedButtonText}>{isArabic ? "عرض الباقات" : "View plans"}</Text></TouchableOpacity></View> : null}
          {isPaidPlan ? <>
          <View style={styles.consumptionHeaderRow}>
            <Text style={styles.consumptionTitle}>{isArabic ? "استهلاك هذا الشهر" : "This month’s usage"}</Text>
            <Text style={styles.consumptionPercent}>{monthlyConsumed === null || monthlyAllowance === null ? "—" : `${percentage}%`}</Text>
          </View>

          {/* Progress bar: background #262626, filled part #0EA5E9 */}
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
          </View>

          <Text style={styles.consumptionSubtitle}>
            {monthlyConsumed === null || monthlyAllowance === null
              ? (isArabic ? "تعذر تحميل بيانات الرصيد والاستهلاك الفعلية." : "Could not load actual balance and usage data.")
              : isArabic ? `استخدمت ${monthlySpent.toLocaleString("ar-EG")} نقطة من باقتك الحالية البالغة ${monthlyTotal.toLocaleString("ar-EG")} نقطة.` : `You used ${monthlySpent.toLocaleString("en-US")} of ${monthlyTotal.toLocaleString("en-US")} plan credits.`}
          </Text>
          </> : null}
        </View>

        {/* 3. قسم سجل الاستهلاك */}
        <View
          style={styles.historySection}
          onLayout={(e) => {
            historyYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.historySectionTitle}>{isArabic ? "سجل الاستهلاك" : "Usage history"}</Text>

          {Object.keys(grouped).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{isArabic ? "لا توجد عمليات استهلاك مسجلة حتى الآن." : "No usage transactions yet."}</Text>
            </View>
          ) : (
            Object.entries(grouped).map(([date, items]) => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateHeader}>{date}</Text>

                {items.map((item) => (
                  <View key={item.id} style={styles.transactionCard}>
                    {/* Right side: Icon + Title + Type/points */}
                    <View style={styles.txRight}>
                      <View style={styles.iconCircle}>{renderIcon(item.type)}</View>
                      <View style={styles.txInfo}>
                        <Text style={styles.txTitle}>{item.title}</Text>
                        <Text style={styles.txMeta}>
                          {item.typeLabel} • {item.points.toLocaleString(isArabic ? "ar-EG" : "en-US")} {isArabic ? "نقطة" : "credits"}
                        </Text>
                      </View>
                    </View>

                    {/* Left side: Amount with - on left in #F87171, time in #A1A1AA */}
                    <View style={styles.txLeft}>
                      {item.isCredit ? (
                        <Text style={styles.creditAmount}>
                          +{item.points.toLocaleString("en-US")}
                        </Text>
                      ) : (
                        <Text style={styles.debitAmount}>
                          -{item.points.toLocaleString("en-US")}
                        </Text>
                      )}
                      <Text style={styles.txTime}>{item.time}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Recharge Sheet / Modal */}
      <Modal
        visible={rechargeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRechargeModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setRechargeModalVisible(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{isArabic ? "الشحن غير مفعّل حاليًا" : "Recharge is not enabled yet"}</Text>
            <Text style={styles.modalSub}>{isArabic ? "لن يُضاف رصيد أو يتغير المبلغ إلا بعد تأكيد عملية شحن فعلية. لا تتوفر عملية دفع مرتبطة بهذه الشاشة الآن." : "Credits and amounts will not change until a real recharge is confirmed. No payment flow is currently connected to this screen."}</Text>

            <TouchableOpacity
              onPress={() => setRechargeModalVisible(false)}
              style={styles.modalCloseBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseText}>{isArabic ? "إغلاق" : "Close"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemePalette, isArabic: boolean) { return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    flexDirection: isArabic ? "row-reverse" : "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  topCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cardHeaderRow: {
    flexDirection: isArabic ? "row-reverse" : "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  upgradeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  upgradeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  dashedDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: colors.divider,
    borderStyle: "dashed",
    marginVertical: 14,
  },
  balanceSection: {
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: isArabic ? "right" : "left",
  },
  balanceNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: isArabic ? "right" : "left",
    marginVertical: 4,
  },
  balanceNotice: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: isArabic ? "right" : "left",
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: isArabic ? "row-reverse" : "row",
    gap: 12,
  },
  rechargeBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  rechargeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  historyBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  historyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  consumptionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  consumptionHeaderRow: {
    flexDirection: isArabic ? "row-reverse" : "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  consumptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  consumptionPercent: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  progressBarBackground: {
    width: "100%",
    height: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 9999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 9999,
  },
  consumptionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: isArabic ? "right" : "left",
    marginTop: 10,
  },
  lockedConsumption: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  lockedText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
  lockedButton: {
    backgroundColor: colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  lockedButtonText: {
    color: colors.onPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
  historySection: {
    marginTop: 8,
    gap: 14,
  },
  historySectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: isArabic ? "right" : "left",
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  dateGroup: {
    gap: 8,
    marginBottom: 6,
  },
  dateHeader: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: isArabic ? "right" : "left",
    paddingHorizontal: 4,
  },
  transactionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    flexDirection: isArabic ? "row-reverse" : "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  txRight: {
    flexDirection: isArabic ? "row-reverse" : "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: {
    flex: 1,
    alignItems: isArabic ? "flex-end" : "flex-start",
  },
  txTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: isArabic ? "right" : "left",
  },
  txMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: isArabic ? "right" : "left",
  },
  txLeft: {
    alignItems: isArabic ? "flex-start" : "flex-end",
    minWidth: 70,
  },
  debitAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.error,
  },
  creditAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.success,
  },
  txTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.divider,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  modalSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  packsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  packItem: {
    flexDirection: isArabic ? "row-reverse" : "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  packItemPopular: {
    borderColor: colors.primary,
  },
  packInfo: {
    flexDirection: isArabic ? "row-reverse" : "row",
    alignItems: "center",
    gap: 8,
  },
  packPoints: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  popularBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  packPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  modalCloseBtn: {
    height: 44,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
}); }