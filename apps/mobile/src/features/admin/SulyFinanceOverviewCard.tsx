import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";

type CostRow = { service_type: string; provider_cost_usd: number; cost_status: string; user_credits_charged: number; revenue_egp: number; provider_cost_egp: number; gross_profit_egp: number; created_at: string };
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
    costUsd: sum.costUsd + Number(row.provider_cost_usd || 0),
    revenue: sum.revenue + Number(row.revenue_egp || 0),
    providerCost: sum.providerCost + Number(row.provider_cost_egp || 0),
    profit: sum.profit + Number(row.gross_profit_egp || 0),
    estimated: sum.estimated + (row.cost_status === "estimated" ? 1 : 0),
  }), { costUsd: 0, revenue: 0, providerCost: 0, profit: 0, estimated: 0 });
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
            ["تكلفة المزود", money(total.costUsd, "USD")],
            ["إيراد الخدمة", money(total.revenue, "EGP")],
            ["تكلفة المزود بالجنيه", money(total.providerCost, "EGP")],
            ["الربح الإجمالي", money(total.profit, "EGP")],
          ].map(([label, value]) => <View key={label} style={{ flexGrow: 1, flexBasis: 140, backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 10, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: "right" }}>{label}</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "900", textAlign: "right" }}>{value}</Text>
          </View>)}
        </View>
        <Text style={{ color: total.estimated ? colors.warning : colors.textMuted, fontSize: 10, textAlign: "right" }}>
          {total.estimated ? `${total.estimated} عملية بتكلفة تقديرية تحتاج مطابقة مع فاتورة المزود.` : "كل التكاليف المسجلة مؤكدة أو تمت تسويتها."}
        </Text>
      </>}
  </View>;
}
