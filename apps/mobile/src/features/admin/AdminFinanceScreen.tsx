import { ScrollView, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { SulyFinanceOverviewCard } from "./SulyFinanceOverviewCard";
import { useSulyTheme } from "../../theme/ThemeProvider";
import { AdminMobileBreadcrumb } from "./AdminMobileBreadcrumb";

export function AdminFinanceScreen() {
  const { colors } = useSulyTheme();
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 1000, width: "100%", alignSelf: "center" }}>
    <AdminMobileBreadcrumb />
    <View style={{ alignItems: "flex-end", gap: 4 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 21, fontWeight: "900", textAlign: "right" }}>المالية والربحية</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "right" }}>قراءة دفتر تكلفة الخدمات الحالي، مع الفصل بين القيم المؤكدة والتقديرية وغير المحسوبة.</Text>
    </View>
    <SulyFinanceOverviewCard />
    <View style={{ borderWidth: 1, borderColor: colors.warning, borderRadius: 10, backgroundColor: colors.surface, padding: 12, gap: 5 }}>
      <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "900", textAlign: "right" }}>تنبيه محاسبي</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 10, lineHeight: 18, textAlign: "right" }}>هذه ليست قائمة أرباح وخسائر نهائية. إيرادات الاشتراكات وتسويات الإعلانات والمصروفات التشغيلية الأخرى تحتاج مصادر محاسبية مؤكدة ومطابقة قبل احتساب صافي الربح. القيم التي لا تتوفر لها قيمة Credit وسعر صرف تظل غير محسوبة.</Text>
    </View>
  </ScrollView>;
}
