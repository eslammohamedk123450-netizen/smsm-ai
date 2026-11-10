import React, { useCallback, useRef, useState } from "react";
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
import { colors } from "../../src/theme/colors";
import { getCreditLedger, getMonthlyCreditUsage, type CreditEntry } from "../../src/features/credits/credit-service";
import { useAuth } from "../../src/features/auth/auth-provider";
import { supabase } from "../../src/lib/supabase/client";

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

function mapCreditEntries(entries: CreditEntry[]): TransactionItem[] {
  return entries
    .filter((entry) => entry.event_type === "settle" || entry.event_type === "admin_adjust" || entry.event_type === "expire")
    .map((entry) => {
      const isCredit = entry.balance_delta > 0;
      const isSettlement = entry.event_type === "settle";
      const isReward = entry.source === "rewarded_ad";
      const date = new Date(entry.created_at);
      const points = isSettlement ? Math.max(0, entry.amount) : Math.abs(entry.balance_delta || entry.amount);
      const title = isSettlement
        ? entry.task_title ? `مهمة: ${entry.task_title}` : "استخدام رصيد لمهمة"
        : isReward ? "مكافأة إعلان مكتملة"
          : entry.event_type === "expire" ? "إعادة الرصيد غير المستخدم"
            : entry.reason || "تعديل رصيد";
      return {
        id: entry.id,
        title,
        type: isSettlement ? "chat" : isCredit ? "recharge" : "other",
        typeLabel: isSettlement ? "استهلاك" : isReward ? "مكافأة" : isCredit ? "إضافة رصيد" : "تعديل",
        points,
        isCredit,
        time: Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        date: Number.isNaN(date.getTime()) ? "تاريخ غير متاح" : date.toLocaleDateString("ar-EG"),
      };
    });
}

export default function BalanceScreen() {
  const router = useRouter();
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
      getCreditLedger(100),
      supabase.from("suly_profiles").select("subscription_tier").eq("id", user.id).maybeSingle(),
    ])
      .then(async ([ledger, profileResult]) => {
        if (!active) return;
        setBalance(ledger.balance);
        setTransactions(mapCreditEntries(ledger.entries));
        setPlanTier(String(profileResult.data?.subscription_tier ?? user.user_metadata?.subscription_tier ?? "").toLowerCase() || null);
        const tier = String(profileResult.data?.subscription_tier ?? user.user_metadata?.subscription_tier ?? "free").toLowerCase();
        if (tier === "free") setMonthlyAllowance(null);
        else {
          const { data: plan } = await supabase.from("subscription_plans").select("monthly_credits,daily_credits").eq("id", tier === "lite" ? 2 : tier === "pro" ? 3 : tier === "max" ? 4 : tier === "ultra" ? 5 : 1).maybeSingle();
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
  }, [user]));

  const monthlySpent = monthlyConsumed ?? 0;
  const isPaidPlan = Boolean(planTier && planTier !== "free");
  const monthlyTotal = monthlyAllowance ?? 0;
  const percentage = monthlyTotal > 0 ? Math.min(100, Math.round((monthlySpent / monthlyTotal) * 100)) : 0;
  const planName = planTier ? planTier.charAt(0).toUpperCase() + planTier.slice(1) : "—";

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
        return <Ionicons name="flash" size={16} color="#4ADE80" />;
      case "chat":
      case "other":
      default:
        return <Ionicons name="chatbubble-ellipses" size={16} color="#0EA5E9" />;
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
          accessibilityLabel="العودة للمحادثة"
        >
          <Ionicons name="arrow-forward" size={22} color="#F5F5F5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الرصيد والاستهلاك</Text>
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
              accessibilityLabel="ترقية الخطة"
            >
              <Text style={styles.upgradeBtnText}>ترقية</Text>
            </TouchableOpacity>
          </View>

          {/* Dotted / dashed separator */}
          <View style={styles.dashedDivider} />

          {/* Current balance */}
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
            {loading ? (
              <ActivityIndicator color="#0EA5E9" style={{ marginVertical: 8 }} />
            ) : (
              <Text style={styles.balanceNumber}>
                {balance === null ? "—" : balance.toLocaleString("en-US")}
              </Text>
            )}
            <Text style={styles.balanceNotice}>
              يتم تحديث الرصيد يوميًا · 30
            </Text>
          </View>

          {/* Two buttons: اشحن رصيد (أبيض/أسود) والسجل (#262626/أبيض) */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => setRechargeModalVisible(true)}
              style={styles.rechargeBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="اشحن رصيد"
            >
              <Text style={styles.rechargeBtnText}>اشحن رصيد</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={scrollToHistory}
              style={styles.historyBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="السجل"
            >
              <Text style={styles.historyBtnText}>السجل</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. كارت الاستهلاك: عنوان استهلاك هذا الشهر + Progress Bar */}
        <View style={styles.consumptionCard}>
          {!isPaidPlan ? <View style={styles.lockedConsumption}><Ionicons name="lock-closed" size={22} color="#A1A1AA" /><Text style={styles.lockedText}>تفاصيل الاستهلاك متاحة للمشتركين في باقة مدفوعة</Text><TouchableOpacity onPress={() => router.push("/(protected)/upgrade")} style={styles.lockedButton}><Text style={styles.lockedButtonText}>عرض الباقات</Text></TouchableOpacity></View> : null}
          {isPaidPlan ? <>
          <View style={styles.consumptionHeaderRow}>
            <Text style={styles.consumptionTitle}>استهلاك هذا الشهر</Text>
            <Text style={styles.consumptionPercent}>{monthlyConsumed === null || monthlyAllowance === null ? "—" : `${percentage}%`}</Text>
          </View>

          {/* Progress bar: background #262626, filled part #0EA5E9 */}
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
          </View>

          <Text style={styles.consumptionSubtitle}>
            {monthlyConsumed === null || monthlyAllowance === null
              ? "تعذر تحميل بيانات الرصيد والاستهلاك الفعلية."
              : `استخدمت ${monthlySpent.toLocaleString("en-US")} نقطة من باقتك الحالية البالغة ${monthlyTotal.toLocaleString("en-US")} نقطة.`}
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
          <Text style={styles.historySectionTitle}>سجل الاستهلاك</Text>

          {Object.keys(grouped).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>لا توجد عمليات استهلاك مسجلة حتى الآن.</Text>
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
                          {item.typeLabel} • {item.points.toLocaleString("en-US")} نقطة
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
            <Text style={styles.modalTitle}>الشحن غير مفعّل حاليًا</Text>
            <Text style={styles.modalSub}>لن يُضاف رصيد أو يتغير المبلغ إلا بعد تأكيد عملية شحن فعلية. لا تتوفر عملية دفع مرتبطة بهذه الشاشة الآن.</Text>

            <TouchableOpacity
              onPress={() => setRechargeModalVisible(false)}
              style={styles.modalCloseBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseText}>إغلاق</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#000000",
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
    color: "#F5F5F5",
  },
  headerSpacer: {
    width: 40,
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
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
    backgroundColor: "#111111",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#262626",
  },
  cardHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  upgradeBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  upgradeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000000",
  },
  dashedDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: "#262626",
    borderStyle: "dashed",
    marginVertical: 14,
  },
  balanceSection: {
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 13,
    color: "#A1A1AA",
    textAlign: "right",
  },
  balanceNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: "#F5F5F5",
    textAlign: "right",
    marginVertical: 4,
  },
  balanceNotice: {
    fontSize: 11,
    color: "#A1A1AA",
    textAlign: "right",
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  rechargeBtn: {
    flex: 1,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  rechargeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000000",
  },
  historyBtn: {
    flex: 1,
    height: 44,
    backgroundColor: "#262626",
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  historyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  consumptionCard: {
    backgroundColor: "#111111",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#262626",
  },
  consumptionHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  consumptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  consumptionPercent: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0EA5E9",
  },
  progressBarBackground: {
    width: "100%",
    height: 10,
    backgroundColor: "#262626",
    borderRadius: 9999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#0EA5E9",
    borderRadius: 9999,
  },
  consumptionSubtitle: {
    fontSize: 13,
    color: "#A1A1AA",
    textAlign: "right",
    marginTop: 10,
  },
  lockedConsumption: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  lockedText: {
    color: "#A1A1AA",
    fontSize: 13,
    textAlign: "center",
  },
  lockedButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  lockedButtonText: {
    color: "#000000",
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
    color: "#F5F5F5",
    textAlign: "right",
  },
  emptyCard: {
    backgroundColor: "#111111",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "#262626",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#A1A1AA",
  },
  dateGroup: {
    gap: 8,
    marginBottom: 6,
  },
  dateHeader: {
    fontSize: 11,
    color: "#A1A1AA",
    textAlign: "right",
    paddingHorizontal: 4,
  },
  transactionCard: {
    backgroundColor: "#111111",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#262626",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  txRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  txTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F5F5F5",
    textAlign: "right",
  },
  txMeta: {
    fontSize: 11,
    color: "#A1A1AA",
    marginTop: 2,
    textAlign: "right",
  },
  txLeft: {
    alignItems: "flex-start",
    minWidth: 70,
  },
  debitAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F87171",
  },
  creditAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4ADE80",
  },
  txTime: {
    fontSize: 11,
    color: "#A1A1AA",
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#1F1F1F",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#262626",
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#333333",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F5F5",
    textAlign: "center",
  },
  modalSub: {
    fontSize: 12,
    color: "#A1A1AA",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  packsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  packItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111111",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#262626",
  },
  packItemPopular: {
    borderColor: "#0EA5E9",
  },
  packInfo: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  packPoints: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  popularBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0EA5E9",
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  packPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#A1A1AA",
  },
  modalCloseBtn: {
    height: 44,
    backgroundColor: "#262626",
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F5F5F5",
  },
});
