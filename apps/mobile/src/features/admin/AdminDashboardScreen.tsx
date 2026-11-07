import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";

const sections = [
  { path: "/admin/hims", title: "إدارة HIMS", detail: "إنشاء أكواد التفعيل وإضافة روابط المحاضرات والملفات" },
  { path: "/admin/api-keys", title: "مزودو الخدمة", detail: "عرض المزودين العامين وإضافة مزود عبر وظيفة محمية" },
  { path: "/admin/models", title: "النماذج والتوجيه", detail: "النماذج المفعلة والمعطلة، الصحة وإعدادات التوجيه" },
  { path: "/admin/users", title: "المستخدمون", detail: "البحث، حالة الحظر، الرصيد وسجل المعاملات" },
  { path: "/admin/credit-management", title: "إدارة الرصيد", detail: "إعدادات التسعير وآخر معاملات التسوية" },
  { path: "/admin/pricing", title: "إدارة الباقات والأسعار", detail: "أسعار Free وLite وPro وMax وحدود الاستخدام وAdMob" },
  { path: "/admin/circuit-breaker", title: "قاطع الدائرة", detail: "غير مكتمل في تطبيق Flutter الحالي؛ لا تُعرض بيانات وهمية" },
] as const;

export function AdminDashboardScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>لوحة المشرف</Text>
      <Text style={styles.subtitle}>تم التحقق من الصلاحية بواسطة suly_is_admin. تظل سياسات RLS وRPC هي حدود الأمان الفعلية.</Text>
      <Link href="/chat" asChild><Pressable style={styles.appButton}><Text style={styles.appButtonText}>الذهاب إلى التطبيق وتجربة المحادثة</Text></Pressable></Link>
      {sections.map((section) => (
        <Link key={section.path} href={section.path} asChild>
          <Pressable style={styles.card}><Text style={styles.cardTitle}>{section.title}</Text><Text style={styles.cardDetail}>{section.detail}</Text></Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 20, gap: 12 }, title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800", textAlign: "right" }, subtitle: { color: colors.textSecondary, textAlign: "right", lineHeight: 21, marginBottom: 8 }, appButton: { padding: 16, borderRadius: 12, backgroundColor: colors.primary }, appButtonText: { color: "#FFFFFF", fontWeight: "800", textAlign: "center" }, card: { padding: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface }, cardTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", textAlign: "right" }, cardDetail: { color: colors.textSecondary, marginTop: 6, textAlign: "right" } });
