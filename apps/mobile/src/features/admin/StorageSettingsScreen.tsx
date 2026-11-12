import { ScrollView, StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { colors } from "../../theme/colors";

export function StorageSettingsScreen() {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <Link href="/admin" asChild><Text style={styles.back}>‹ لوحة المشرف</Text></Link>
      <Text style={styles.title}>التخزين</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.description}>ملفات التطبيق محفوظة بشكل خاص، ولا يمكن الوصول إليها إلا من خلال الصلاحيات المعتمدة داخل التطبيق.</Text>
      <Text style={styles.status}>لا يتطلب إعدادًا إضافيًا داخل التطبيق.</Text>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, maxWidth: 780, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  back: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "900", textAlign: "right" },
  card: { padding: 16, gap: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  description: { color: colors.textSecondary, fontSize: 12, lineHeight: 20, textAlign: "right" },
  status: { color: colors.success, fontSize: 12, fontWeight: "800", textAlign: "right" },
});
