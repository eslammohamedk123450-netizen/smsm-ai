import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";

type CostRow = { service_type: string; provider_cost_usd: number | null; cost_status: string; user_credits_charged: number; revenue_egp: number | null; provider_cost_egp: number | null; gross_profit_egp: number | null; created_at: string };
const money = (value: number, currency: string) => `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;

export function SulyFinanceOverviewCard() {
  const [rows, setRows] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data, error: queryError } = await supabase.from("suly_company_cost_ledger")
      .select("service_type,provider_cost_usd,cost_status,user_credits_charged,revenue_egp,provider_cost_egp,gross_profit_egp,created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
    if (queryError) setError("تعذر تحميل دفتر تكلفة المزودين.");
    else setRows((data ?? []) as CostRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const total = rows.reduce((sum, row) => ({
    costUsd: sum.costUsd + (row.provider_cost_usd === null ? 0 : Number(row.provider_cost_usd)),
    usdCount: sum.usdCount + (row.provider_cost_usd === null ? 0 : 1),
    revenue: sum.revenue + (row.revenue_egp === null ? 0 : Number(row.revenue_egp)),
    revenueCount: sum.revenueCount + (row.revenue_egp === null ? 0 : 1),
    providerCost: sum.providerCost + (row.provider_cost_egp === null ? 0 : Number(row.provider_cost_egp)),
    providerCostCount: sum.providerCostCount + (row.provider_cost_egp === null ? 0 : 1),
    profit: sum.profit + (row.gross_profit_egp === null ? 0 : Number(row.gross_profit_egp)),
    profitCount: sum.profitCount + (row.gross_profit_egp === null ? 0 : 1),
    estimated: sum.estimated + (row.cost_status === "estimated" ? 1 : 0),
    unknown: sum.unknown + (row.cost_status === "unknown" ? 1 : 0),
    confirmedEgp: sum.confirmedEgp + (row.cost_status === "confirmed_egp" ? 1 : 0),
  }), { costUsd: 0, usdCount: 0, revenue: 0, revenueCount: 0, providerCost: 0, providerCostCount: 0, profit: 0, profitCount: 0, estimated: 0, unknown: 0, confirmedEgp: 0 });
  return <View style={{ backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }}>
    <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "900", textAlign: "right" }}>دفتر التكلفة والربحية</Text>
        <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: "right" }}>آخر 30 يومًا · {rows.length} عملية مسجلة</Text>
      </View>
      <Pressable onPress={() => void load()}><Text style={{ color: colors.primary, fontWeight: "800" }}>تحديث</Text></Pressable>
    </View>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <Text style={{ color: colors.error, textAlign: "right" }}>{error}</Text> : rows.length === 0
      ? <Text style={{ color: colors.textMuted, textAlign: "right", lineHeight: 20 }}>لم تُسجل عمليات تكلفة بعد. ستظهر هنا تكلفة المزود بالدولار، والإيراد بالجنيه، وهامش الربح بعد ربط الأسعار وتشغيل الخدمات.</Text>
      : <>
        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
          {[
            ["تكلفة المزود", total.usdCount ? money(total.costUsd, "USD") : "غير متاح"],
            ["إيراد الخدمة", total.revenueCount ? money(total.revenue, "EGP") : "غير محسوب"],
            ["تكلفة المزود بالجنيه", total.providerCostCount ? money(total.providerCost, "EGP") : "غير متاح"],
            ["الربح الإجمالي", total.profitCount ? money(total.profit, "EGP") : "غير محسوب"],
          ].map(([label, value]) => <View key={label} style={{ flexGrow: 1, flexBasis: 140, backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 10, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: "right" }}>{label}</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "900", textAlign: "right" }}>{value}</Text>
          </View>)}
        </View>
        <Text style={{ color: total.estimated || total.unknown ? colors.warning : colors.textMuted, fontSize: 10, textAlign: "right" }}>
          {[
            total.unknown ? `${total.unknown} عملية لم يُرجع مزودها تكلفة مؤكدة.` : "",
            total.confirmedEgp ? `${total.confirmedEgp} تكلفة مؤكدة بالجنيه دون تحويل USD.` : "",
            total.estimated ? `${total.estimated} عملية بتكلفة تقديرية تحتاج مطابقة.` : "",
            total.profitCount < rows.length ? "الإيراد والربح غير محسوبين للعمليات التي لم تُضبط لها قيمة Credit وسعر صرف." : "",
          ].filter(Boolean).join(" ")}
        </Text>
      </>}
  </View>;
}
