import React, { useRef, useState, useEffect } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../src/components/ui/PremiumText";
import { colors } from "../../src/theme/colors";
import { getCreditLedger } from "../../src/features/credits/credit-service";
import { useAuth } from "../../src/features/auth/auth-provider";
import { useToast } from "../../src/components/ui/Toast";

interface TransactionItem {
  id: string;
  title: string;
  type: "chat" | "document" | "recharge" | "image";
  typeLabel: string;
  points: number;
  isCredit: boolean;
  time: string;
  date: string;
}

const INITIAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: "tx-1",
    title: "استفسار مالي تنفيذي",
    type: "chat",
    typeLabel: "محادثة",
    points: 131,
    isCredit: false,
    time: "14:25",
    date: "9 نوفمبر 2026",
  },
  {
    id: "tx-2",
    title: "صياغة عقد تجاري",
    type: "document",
    typeLabel: "مستند",
    points: 280,
    isCredit: false,
    time: "11:40",
    date: "9 نوفمبر 2026",
  },
  {
    id: "tx-3",
    title: "شحن رصيد نقاط",
    type: "recharge",
    typeLabel: "شحن رصيد",
    points: 5000,
    isCredit: true,
    time: "09:15",
    date: "9 نوفمبر 2026",
  },
  {
    id: "tx-4",
    title: "تحليل موازنة سنوية",
    type: "chat",
    typeLabel: "محادثة",
    points: 420,
    isCredit: false,
    time: "18:10",
    date: "8 نوفمبر 2026",
  },
  {
    id: "tx-5",
    title: "توليد رسم بياني",
    type: "image",
    typeLabel: "صورة",
    points: 350,
    isCredit: false,
    time: "15:30",
    date: "8 نوفمبر 2026",
  },
  {
    id: "tx-6",
    title: "تدقيق شروط الخدمة",
    type: "document",
    typeLabel: "مستند",
    points: 195,
    isCredit: false,
    time: "10:05",
    date: "8 نوفمبر 2026",
  },
];

export default function BalanceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { show } = useToast();
  const scrollRef = useRef<any>(null);
  const historyYRef = useRef<number>(0);

  const [balance, setBalance] = useState<number>(9850);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS);
  const [rechargeModalVisible, setRechargeModalVisible] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) return;
    setLoading(true);
    void getCreditLedger(50)
      .then((ledger) => {
        if (!active) return;
        if (typeof ledger.balance === "number") {
          setBalance(ledger.balance);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const monthlyConsumed = 2340;
  const monthlyTotal = 10100;
  const percentage = Math.min(100, Math.round((monthlyConsumed / monthlyTotal) * 100));

  // Group transactions by date
  const grouped = transactions.reduce<Record<string, TransactionItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const scrollToHistory = () => {
    scrollRef.current?.scrollTo({ y: historyYRef.current, animated: true });
  };

  const handleRechargePack = (points: number) => {
    const newBal = balance + points;
    setBalance(newBal);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newTx: TransactionItem = {
      id: `tx-rec-${Date.now()}`,
      title: "شحن رصيد نقاط",
      type: "recharge",
      typeLabel: "شحن رصيد",
      points,
      isCredit: true,
      time: timeStr,
      date: "9 نوفمبر 2026",
    };
    setTransactions((prev) => [newTx, ...prev]);
    setRechargeModalVisible(false);
    show(`تم شحن ${points.toLocaleString("ar-EG")} نقطة بنجاح`, "success");
  };

  const renderIcon = (type: TransactionItem["type"]) => {
    switch (type) {
      case "recharge":
        return <Ionicons name="flash" size={16} color="#4ADE80" />;
      case "image":
        return <Ionicons name="image" size={16} color="#0EA5E9" />;
      case "document":
        return <Ionicons name="document-text" size={16} color="#0EA5E9" />;
      case "chat":
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
            <Text style={styles.planName}>Free</Text>
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
                {balance.toLocaleString("en-US")}
              </Text>
            )}
            <Text style={styles.balanceNotice}>
              يتم تحديث الرصيد يوميا في 23:00 إلى 3:00
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
          <View style={styles.consumptionHeaderRow}>
            <Text style={styles.consumptionTitle}>استهلاك هذا الشهر</Text>
            <Text style={styles.consumptionPercent}>{percentage}%</Text>
          </View>

          {/* Progress bar: background #262626, filled part #0EA5E9 */}
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
          </View>

          <Text style={styles.consumptionSubtitle}>
            استخدمت {monthlyConsumed.toLocaleString("en-US")} من {monthlyTotal.toLocaleString("en-US")} نقطة
          </Text>
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
            <Text style={styles.modalTitle}>شحن رصيد نقاط Suly</Text>
            <Text style={styles.modalSub}>اختر باقة النقاط المناسبة لمؤسستك</Text>

            <View style={styles.packsContainer}>
              {[
                { points: 1000, price: "50 ج.م" },
                { points: 5000, price: "200 ج.م", popular: true },
                { points: 10000, price: "350 ج.م" },
                { points: 25000, price: "750 ج.م" },
              ].map((pack) => (
                <TouchableOpacity
                  key={pack.points}
                  onPress={() => handleRechargePack(pack.points)}
                  style={[styles.packItem, pack.popular && styles.packItemPopular]}
                  activeOpacity={0.8}
                >
                  <View style={styles.packInfo}>
                    <Text style={styles.packPoints}>+{pack.points.toLocaleString("ar-EG")} نقطة</Text>
                    {pack.popular ? <Text style={styles.popularBadge}>الأكثر طلباً</Text> : null}
                  </View>
                  <Text style={styles.packPrice}>{pack.price}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setRechargeModalVisible(false)}
              style={styles.modalCloseBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseText}>إلغاء</Text>
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
